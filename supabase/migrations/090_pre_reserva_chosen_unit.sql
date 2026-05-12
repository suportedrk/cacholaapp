-- supabase/migrations/090_pre_reserva_chosen_unit.sql
-- Objetivo: corrigir unidade nas pré-reservas Ploomes usando o campo "Unidade Escolhida"
-- do Order (FieldKey order_EDD14E93-ECEB-4EEE-A362-80416A78E61D) em vez da
-- "Unidade Pretendida" do Deal (deal_BD9C4B07), que não é atualizada quando o
-- cliente muda de unidade durante a negociação.
-- Diagnóstico: 1 deal ativo (604997051) divergia DB=moema vs Order=pinheiros.

BEGIN;

-- ─── 1. Nova coluna em ploomes_orders ───────────────────────────────────────

ALTER TABLE public.ploomes_orders
  ADD COLUMN IF NOT EXISTS chosen_unit_id UUID REFERENCES public.units(id);

CREATE INDEX IF NOT EXISTS idx_ploomes_orders_chosen_unit
  ON public.ploomes_orders (deal_id, chosen_unit_id)
  WHERE chosen_unit_id IS NOT NULL;

COMMENT ON COLUMN public.ploomes_orders.chosen_unit_id IS
  'Unidade ESCOLHIDA da festa (FieldKey order_EDD14E93-ECEB-4EEE-A362-80416A78E61D no Ploomes, '
  'ObjectValueName "Cachola PINHEIROS" / "Cachola MOEMA"). '
  'Diferente de unit_id, que herda de ploomes_deals.unit_id (Unidade Pretendida). '
  'NULL = campo ainda não sincronizado ou não preenchido no Ploomes.';

-- ─── 2. Recriar pre_reservas_ploomes_view com COALESCE + unit_source ────────

DROP VIEW IF EXISTS public.pre_reservas_ploomes_view;

CREATE VIEW public.pre_reservas_ploomes_view
WITH (security_invoker = true)
AS
SELECT
  pd.ploomes_deal_id::text                                        AS id,
  pd.ploomes_deal_id                                              AS deal_id,
  COALESCE(o.chosen_unit_id, pd.unit_id)                         AS unit_id,
  CASE
    WHEN o.chosen_unit_id IS NOT NULL THEN 'order'::text
    ELSE 'deal'::text
  END                                                             AS unit_source,
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
  'ploomes'::text                                                  AS source
FROM public.ploomes_deals pd
LEFT JOIN LATERAL (
  SELECT chosen_unit_id
  FROM public.ploomes_orders
  WHERE deal_id = pd.ploomes_deal_id
    AND chosen_unit_id IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1
) o ON true
WHERE pd.status_id = 1
  AND pd.stage_id IN (60004416, 60056754)
  AND pd.event_date IS NOT NULL
  AND pd.event_date >= CURRENT_DATE - INTERVAL '7 days';

GRANT SELECT ON public.pre_reservas_ploomes_view TO authenticated;

COMMIT;
