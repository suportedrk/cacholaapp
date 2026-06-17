BEGIN;
DROP TABLE IF EXISTS public.cachola_migration_log;
NOTIFY pgrst, 'reload schema';
COMMIT;
