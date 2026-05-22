-- ============================================================
-- ROLLBACK da Migration 095 — Trigger de guarda da aprovacao de custo
-- ============================================================
-- Reverte 095_maintenance_cost_approval_trigger.sql: remove o trigger
-- trg_guard_cost_approval e a funcao guard_cost_approval().
--
-- Apos o rollback, a aprovacao de custo volta a ser controlada apenas
-- pela RLS de UPDATE da migration 094 ("maintenance_executions: edit"),
-- que NAO distingue colunas -- ou seja, a porta dos fundos §4.2.4
-- volta a ficar aberta para roles com 'edit' (ex.: manutencao).
-- Use somente se o trigger 095 precisar ser revertido.
--
-- USO:
--   docker exec -i supabase-db psql -U postgres -d postgres \
--     < supabase/migrations/095_maintenance_cost_approval_trigger_rollback.sql
-- Idempotente: DROP ... IF EXISTS.
-- ============================================================

BEGIN;

DROP TRIGGER  IF EXISTS trg_guard_cost_approval ON public.maintenance_executions;
DROP FUNCTION IF EXISTS public.guard_cost_approval();

COMMIT;
