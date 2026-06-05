-- ============================================================
-- Rollback da Migration 150 — is_festa_ganha (Fase 3a)
-- ============================================================
-- ATENÇÃO: só reverter APÓS reverter a migration 151 (as RPCs dependem desta função).

BEGIN;

DROP FUNCTION IF EXISTS public.is_festa_ganha(integer, bigint);

NOTIFY pgrst, 'reload schema';

COMMIT;
