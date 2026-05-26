-- ============================================================
-- Migration 111 — Backups: backfill aditivo de user_permissions (Fase 2)
-- Criado em: 2026-05-26
-- Referência: docs/rbac/proposta-arquitetura-alvo.md Item 6 (Fase 1)
--             + receita do piloto Equipamentos (108/109/110)
--
-- Primeira de DUAS migrations que migram o módulo backups para o
-- molde de ouro de forma INVISÍVEL em runtime:
--   111 — user_permissions backfill aditivo (esta migration)
--   112 — RLS golden pattern (troca de fato da policy de SELECT)
--
-- Não há migration de "template alignment" para backups porque o
-- template atual (role_permissions seed da 071) já reflete o acesso
-- real: diretor.view=true + super_admin tudo via CROSS JOIN.
-- super_admin tem bypass na check_permission, então não precisa de
-- backfill.
--
-- ESCOPO ÚNICO desta migration: para cada usuário ATIVO com cargo
-- diretor, garantir que exista linha em user_permissions com
-- (module='backups', action='view', granted=true, unit_id=NULL).
-- ON CONFLICT DO NOTHING preserva linhas customizadas pré-existentes.
--
-- super_admin é EXCLUÍDO de propósito (bypass em check_permission).
--
-- Não-destrutivo. Idempotente.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Pré-condição: catálogo permission_controls tem 'backups.view'
-- ------------------------------------------------------------
DO $$
DECLARE
  v_ok BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.permission_controls
    WHERE module_code = 'backups' AND code = 'view' AND kind = 'action'
  ) INTO v_ok;

  IF NOT v_ok THEN
    RAISE EXCEPTION
      'Abortando: permission_controls(backups, view) ausente. Migration 107 precisa estar aplicada.';
  END IF;
END
$$;

-- ------------------------------------------------------------
-- Contagem pré-backfill (para log)
-- ------------------------------------------------------------
DO $$
DECLARE
  v_before INT;
BEGIN
  SELECT COUNT(*) INTO v_before
  FROM public.user_permissions WHERE module = 'backups';
  RAISE NOTICE 'user_permissions em backups antes do backfill: %', v_before;
END
$$;

-- ------------------------------------------------------------
-- Backfill aditivo: insere (user_id, NULL, 'backups', 'view', true)
-- para cada diretor ativo que não tem essa linha ainda.
-- ------------------------------------------------------------
INSERT INTO public.user_permissions (user_id, unit_id, module, action, granted)
SELECT
  u.id              AS user_id,
  NULL::UUID        AS unit_id,
  'backups'         AS module,
  'view'            AS action,
  true              AS granted
FROM public.users u
WHERE u.role = 'diretor'
  AND u.is_active = true
ON CONFLICT (user_id, unit_id, module, action) DO NOTHING;

-- ------------------------------------------------------------
-- Pós-condição: cada diretor ativo tem cobertura de backups.view
-- ------------------------------------------------------------
DO $$
DECLARE
  v_after INT;
  v_short INT;
BEGIN
  SELECT COUNT(*) INTO v_after
  FROM public.user_permissions WHERE module = 'backups';

  SELECT COUNT(*) INTO v_short
  FROM public.users u
  WHERE u.role = 'diretor' AND u.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = u.id
        AND up.module = 'backups'
        AND up.action = 'view'
        AND up.granted = true
    );

  RAISE NOTICE 'user_permissions em backups após backfill: %', v_after;
  RAISE NOTICE 'diretores ativos SEM backups.view granted=true: %', v_short;

  IF v_short > 0 THEN
    RAISE WARNING
      '% diretor(es) ativo(s) ficaram sem backups.view granted=true. Linha granted=false pré-existente pode ter sido preservada pelo ON CONFLICT DO NOTHING. Investigar antes da migration 112.',
      v_short;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
