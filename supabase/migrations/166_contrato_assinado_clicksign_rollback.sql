-- Rollback da Migration 166 - remove contract_signed e clicksign_signed_field_key.
-- Sem BEGIN/COMMIT/ROLLBACK nem NOTIFY (padrao esteira).

DROP INDEX IF EXISTS public.idx_events_contract_unsigned;

ALTER TABLE public.events
  DROP COLUMN IF EXISTS contract_signed;

ALTER TABLE public.ploomes_orders
  DROP COLUMN IF EXISTS contract_signed;

ALTER TABLE public.ploomes_config
  DROP COLUMN IF EXISTS clicksign_signed_field_key;
