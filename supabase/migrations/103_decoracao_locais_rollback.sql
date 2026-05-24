-- Rollback Migration 103 — decoracao_locais
DROP TABLE IF EXISTS public.decoracao_locais CASCADE;
NOTIFY pgrst, 'reload schema';
COMMIT;
