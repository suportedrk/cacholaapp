-- ============================================================
-- Rollback Migration 102 — Remove tabela decoracao_fornecedores
-- ============================================================

BEGIN;

DROP TABLE IF EXISTS public.decoracao_fornecedores CASCADE;

NOTIFY pgrst, 'reload schema';

COMMIT;
