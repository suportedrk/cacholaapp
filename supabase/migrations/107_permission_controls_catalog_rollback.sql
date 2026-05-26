-- ============================================================
-- Rollback da Migration 107 — permission_controls catalog
-- Restaura o estado anterior: CHECK constraint estreito em .action
-- e remove a tabela permission_controls + FKs compostas.
--
-- Esta migration é não-destrutiva no sentido inverso: como
-- user_permissions/role_permissions não tiveram suas linhas alteradas
-- pela 107, basta reverter as constraints e dropar a tabela nova.
--
-- Idempotente — pode rodar mesmo se 107 nunca foi aplicada.
-- ============================================================

BEGIN;

-- 1. Remover FKs compostas
ALTER TABLE public.user_permissions
  DROP CONSTRAINT IF EXISTS user_permissions_module_action_fk;

ALTER TABLE public.role_permissions
  DROP CONSTRAINT IF EXISTS role_permissions_module_action_fk;

-- 2. Restaurar CHECK constraints originais (idempotente — só adiciona se faltar)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_permissions_action_check'
      AND conrelid = 'public.user_permissions'::regclass
  ) THEN
    ALTER TABLE public.user_permissions
      ADD CONSTRAINT user_permissions_action_check
      CHECK (action IN ('view','create','edit','delete','export'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'role_permissions_action_check'
      AND conrelid = 'public.role_permissions'::regclass
  ) THEN
    ALTER TABLE public.role_permissions
      ADD CONSTRAINT role_permissions_action_check
      CHECK (action IN ('view','create','edit','delete','export'));
  END IF;
END
$$;

-- 3. Remover índice e tabela
DROP INDEX IF EXISTS public.idx_permission_controls_module_sort;

DROP TABLE IF EXISTS public.permission_controls CASCADE;

-- 4. Recarregar cache do PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;
