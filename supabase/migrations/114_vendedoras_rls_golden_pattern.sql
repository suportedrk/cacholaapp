-- ============================================================
-- Migration 114 — Vendedoras: RLS no molde de ouro adaptado (Fase 2)
-- Criado em: 2026-05-26
-- Referência: docs/rbac/proposta-arquitetura-alvo.md
--             + Opção A do dono (catálogo compartilhado, Aprendizado 3)
--
-- Segunda e última migration do módulo vendedoras.
-- Substitui as policies de INSERT/UPDATE/DELETE em public.sellers
-- pelas versões com check_permission. SELECT permanece intacta
-- (auth.uid() IS NOT NULL) — sellers é catálogo lido por BI,
-- dropdowns e JOINs de outros módulos (Aprendizado 3).
--
-- ── ADAPTAÇÃO DO MOLDE DE OURO ──────────────────────────────────
-- sellers é tabela GLOBAL (não tem coluna unit_id). Por isso:
--   1. SEM filtro de unidade.
--   2. SELECT mantido aberto (auth.uid() IS NOT NULL).
--      NÃO portar para check_permission — quebraria dropdowns e BI.
--   3. INSERT/UPDATE/DELETE migram para check_permission.
--
-- Resultado esperado (idêntico ao ANTES):
--   - super_admin: SELECT/INSERT/UPDATE/DELETE OK (bypass)
--   - diretor: SELECT/INSERT/UPDATE OK; DELETE BLK
--             (template.delete=false após 113; só super_admin deleta)
--   - 9 demais cargos: SELECT OK (policy original mantida);
--                      INSERT/UPDATE/DELETE BLK (sem permission)
--
-- Pré-condições:
--   - migration 107 aplicada (permission_controls catalog)
--   - migration 113 aplicada (template fix + backfill)
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Pré-validação: diretores ativos com create+edit granted=true
-- ------------------------------------------------------------
DO $$
DECLARE
  v_short INT;
BEGIN
  SELECT COUNT(*) INTO v_short
  FROM public.users u
  WHERE u.role = 'diretor'
    AND u.is_active = true
    AND (
      SELECT COUNT(*) FROM public.user_permissions up
      WHERE up.user_id = u.id
        AND up.module = 'vendedoras'
        AND up.action IN ('create','edit')
        AND up.granted = true
    ) <> 2;

  IF v_short > 0 THEN
    RAISE EXCEPTION
      'Abortando: % diretor(es) ativo(s) sem vendedoras.create/edit granted=true em user_permissions. Aplicar migration 113 antes desta.',
      v_short;
  END IF;
END
$$;

-- ------------------------------------------------------------
-- PASSO 1 — DROP policies antigas de escrita (idempotente)
-- ------------------------------------------------------------
-- Originais da 053:
DROP POLICY IF EXISTS "sellers_insert_admin_diretor" ON public.sellers;
DROP POLICY IF EXISTS "sellers_update_admin_diretor" ON public.sellers;
DROP POLICY IF EXISTS "sellers_delete_super_admin"   ON public.sellers;

-- Nomes novos (idempotência em re-execução):
DROP POLICY IF EXISTS "vendedoras: create" ON public.sellers;
DROP POLICY IF EXISTS "vendedoras: edit"   ON public.sellers;
DROP POLICY IF EXISTS "vendedoras: delete" ON public.sellers;

-- ⚠ "sellers_select_authenticated" NÃO é dropada — fica como está.

-- ------------------------------------------------------------
-- PASSO 2 — CREATE policies novas (só escrita)
-- ------------------------------------------------------------
-- INSERT
CREATE POLICY "vendedoras: create" ON public.sellers
  FOR INSERT TO authenticated
  WITH CHECK (
    check_permission(auth.uid(), 'vendedoras', 'create')
  );

-- UPDATE
CREATE POLICY "vendedoras: edit" ON public.sellers
  FOR UPDATE TO authenticated
  USING (
    check_permission(auth.uid(), 'vendedoras', 'edit')
  )
  WITH CHECK (
    check_permission(auth.uid(), 'vendedoras', 'edit')
  );

-- DELETE
CREATE POLICY "vendedoras: delete" ON public.sellers
  FOR DELETE TO authenticated
  USING (
    check_permission(auth.uid(), 'vendedoras', 'delete')
  );

-- ------------------------------------------------------------
-- PASSO 3 — Pós-validação
-- ------------------------------------------------------------
DO $$
DECLARE
  v_select INT;
  v_insert INT;
  v_update INT;
  v_delete INT;
BEGIN
  -- Espera: 1 policy SELECT (original) + 3 novas (create/edit/delete) = 4 total
  SELECT COUNT(*) INTO v_select
  FROM pg_policies
  WHERE schemaname='public' AND tablename='sellers' AND cmd='SELECT';

  SELECT COUNT(*) INTO v_insert
  FROM pg_policies
  WHERE schemaname='public' AND tablename='sellers' AND policyname='vendedoras: create';

  SELECT COUNT(*) INTO v_update
  FROM pg_policies
  WHERE schemaname='public' AND tablename='sellers' AND policyname='vendedoras: edit';

  SELECT COUNT(*) INTO v_delete
  FROM pg_policies
  WHERE schemaname='public' AND tablename='sellers' AND policyname='vendedoras: delete';

  IF v_select <> 1 OR v_insert <> 1 OR v_update <> 1 OR v_delete <> 1 THEN
    RAISE EXCEPTION
      'Pós-condição falhou: esperava 1 SELECT + 3 policies novas. Achei SELECT=%, create=%, edit=%, delete=%.',
      v_select, v_insert, v_update, v_delete;
  END IF;

  RAISE NOTICE 'OK: 1 policy SELECT preservada (sellers_select_authenticated) + 3 novas (vendedoras: create/edit/delete).';
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
