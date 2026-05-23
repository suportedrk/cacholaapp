-- ============================================================
-- Rollback migration 098 — remove tabela decoracao_balao_modelos
-- ============================================================

BEGIN;

DROP TABLE IF EXISTS public.decoracao_balao_modelos CASCADE;

NOTIFY pgrst, 'reload schema';

COMMIT;
