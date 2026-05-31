-- Rollback Migration 128 — decoracao_categorias
DROP TABLE IF EXISTS public.decoracao_categorias CASCADE;
NOTIFY pgrst, 'reload schema';
COMMIT;
