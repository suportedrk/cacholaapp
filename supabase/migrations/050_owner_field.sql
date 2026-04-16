-- =============================================================
-- Migration 050 — Responsável/Vendedora (owner)
-- Adiciona owner_id + owner_name em ploomes_deals e events.
-- Atualiza a VIEW pre_reservas_ploomes_view para incluir owner_name.
-- =============================================================

BEGIN;

-- ── ploomes_deals ─────────────────────────────────────────────
ALTER TABLE public.ploomes_deals
  ADD COLUMN IF NOT EXISTS owner_id   INTEGER,
  ADD COLUMN IF NOT EXISTS owner_name TEXT;

COMMENT ON COLUMN public.ploomes_deals.owner_id   IS 'Ploomes OwnerId — ID do responsável/vendedora do deal';
COMMENT ON COLUMN public.ploomes_deals.owner_name IS 'Nome do responsável/vendedora (Owner.Name no Ploomes)';

CREATE INDEX IF NOT EXISTS idx_ploomes_deals_owner
  ON public.ploomes_deals (owner_name)
  WHERE owner_name IS NOT NULL;

-- ── events ───────────────────────────────────────────────────
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS owner_id   INTEGER,
  ADD COLUMN IF NOT EXISTS owner_name TEXT;

COMMENT ON COLUMN public.events.owner_id   IS 'Ploomes OwnerId — ID da vendedora responsável (copiado do deal)';
COMMENT ON COLUMN public.events.owner_name IS 'Nome da vendedora responsável (Owner.Name no Ploomes)';

CREATE INDEX IF NOT EXISTS idx_events_owner
  ON public.events (owner_name)
  WHERE owner_name IS NOT NULL;

-- ── VIEW: recriar com owner_name ──────────────────────────────
CREATE OR REPLACE VIEW public.pre_reservas_ploomes_view
WITH (security_invoker = true)
AS
SELECT
  pd.ploomes_deal_id::text                                        AS id,
  pd.ploomes_deal_id                                              AS deal_id,
  pd.unit_id,
  pd.event_date                                                   AS date,
  pd.start_time,
  pd.end_time,
  pd.contact_name                                                 AS client_name,
  pd.contact_phone                                                AS client_contact,
  pd.title                                                        AS deal_title,
  pd.deal_amount,
  pd.stage_id,
  pd.stage_name,
  pd.owner_name,
  pd.created_at,
  pd.updated_at,
  'https://app10.ploomes.com/deal/' || pd.ploomes_deal_id::text   AS ploomes_url,
  'ploomes'::text                                                 AS source
FROM public.ploomes_deals pd
WHERE pd.status_id = 1
  AND pd.stage_id IN (60004416, 60056754)
  AND pd.event_date IS NOT NULL
  AND pd.event_date >= CURRENT_DATE - INTERVAL '7 days';

GRANT SELECT ON public.pre_reservas_ploomes_view TO authenticated;

COMMIT;
