-- ============================================================
-- Rollback da Migration 149 — unidade canônica da festa (Fase 1)
-- ============================================================
-- Reverte a função-regra e a coluna escolhida_unit_id.
-- Seguro: não há dado de produção dependente nesta fase (sem backfill).

BEGIN;

ALTER TABLE public.ploomes_deals
  DROP COLUMN IF EXISTS escolhida_unit_id;

DROP FUNCTION IF EXISTS public.resolve_festa_unit(uuid, uuid, uuid);

NOTIFY pgrst, 'reload schema';

COMMIT;
