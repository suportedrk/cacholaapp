-- ============================================================
-- Migration 112 — Backups: RLS no molde de ouro adaptado (Fase 2)
-- Criado em: 2026-05-26
-- Referência: docs/rbac/proposta-arquitetura-alvo.md Item 2 (molde de ouro)
--             + Fase 1 do Item 6 + receita do piloto Equipamentos
--
-- Segunda e última migration do módulo backups.
-- Substitui a policy "backup_log_select" (que usa role IN inline,
-- criada na 067) por uma nova que chama check_permission(auth.uid(),
-- 'backups', 'view').
--
-- ── ADAPTAÇÃO DO MOLDE DE OURO ──────────────────────────────────
-- backup_log é um LOG GLOBAL DE ADMIN (não escopado por unidade —
-- não tem coluna unit_id). Por isso:
--   1. NÃO aplicar filtro de unidade (is_global_viewer / get_user_unit_ids).
--      Quem tem permissão 'backups.view' vê tudo.
--   2. NÃO criar policies de INSERT/UPDATE/DELETE — preservando o
--      comportamento atual em que NINGUÉM escreve via JWT (nem
--      super_admin nem diretor). Todos os INSERTs em backup_log
--      acontecem via service_role nos scripts de backup e cron.
--      Criar policy de INSERT abriria uma porta de escrita via JWT
--      para super_admin (que tem bypass em check_permission) — uma
--      EXPANSÃO de comportamento que não é necessária.
--
-- Resultado:
--   - super_admin: SELECT OK (via bypass de check_permission). Idêntico ao antes.
--   - diretor: SELECT OK se tem user_permissions[backups.view]=true (garantido pela 111).
--   - demais 9 cargos: SELECT bloqueado (sem permission no template).
--   - Escrita via JWT continua impossível para todos os cargos.
--   - service_role continua escrevendo livremente (bypassa RLS).
--
-- Pré-condições:
--   - migration 107 aplicada (permission_controls catalog)
--   - migration 111 aplicada (backfill de user_permissions)
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Pré-validação: diretores ativos com backups.view granted=true
-- ------------------------------------------------------------
DO $$
DECLARE
  v_short INT;
BEGIN
  SELECT COUNT(*) INTO v_short
  FROM public.users u
  WHERE u.role = 'diretor'
    AND u.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = u.id
        AND up.module = 'backups'
        AND up.action = 'view'
        AND up.granted = true
    );

  IF v_short > 0 THEN
    RAISE EXCEPTION
      'Abortando: % diretor(es) ativo(s) sem backups.view granted=true em user_permissions. Aplicar migration 111 antes desta.',
      v_short;
  END IF;
END
$$;

-- ------------------------------------------------------------
-- PASSO 1 — DROP policy antiga (idempotente)
-- ------------------------------------------------------------
-- Policy original da 067 (role IN inline):
DROP POLICY IF EXISTS "backup_log_select" ON public.backup_log;

-- Nome novo (idempotência em re-execução):
DROP POLICY IF EXISTS "backups: view" ON public.backup_log;

-- ------------------------------------------------------------
-- PASSO 2 — CREATE policy no molde de ouro adaptado
-- ------------------------------------------------------------
-- Apenas SELECT. SEM filtro de unidade (backup_log não tem unit_id).
-- SEM policies de INSERT/UPDATE/DELETE — escrita continua só via service_role.
CREATE POLICY "backups: view" ON public.backup_log
  FOR SELECT TO authenticated
  USING (
    check_permission(auth.uid(), 'backups', 'view')
  );

-- ------------------------------------------------------------
-- PASSO 3 — Pós-validação: existe exatamente 1 policy em backup_log
-- ------------------------------------------------------------
DO $$
DECLARE
  v_count INT;
  v_view_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'backup_log';

  SELECT COUNT(*) INTO v_view_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'backup_log'
    AND policyname = 'backups: view';

  IF v_view_count <> 1 THEN
    RAISE EXCEPTION
      'Pós-condição falhou: esperava 1 policy "backups: view" em backup_log, encontrei %.',
      v_view_count;
  END IF;

  RAISE NOTICE 'OK: % policy(ies) em backup_log; "backups: view" criada.', v_count;
  RAISE NOTICE 'Notas:';
  RAISE NOTICE '  - SEM filtro de unidade (backup_log é log global).';
  RAISE NOTICE '  - SEM policies de INSERT/UPDATE/DELETE (escrita só via service_role).';
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
