-- supabase/migrations/105_decoracao_estoque_saldo_rollback.sql
-- Rollback da migration 105 — remove tabela de saldo e artefatos relacionados.

BEGIN;

DROP TABLE  IF EXISTS public.decoracao_estoque_saldo CASCADE;
DROP FUNCTION IF EXISTS public.trg_estoque_saldo_updated_at();

NOTIFY pgrst, 'reload schema';

COMMIT;
