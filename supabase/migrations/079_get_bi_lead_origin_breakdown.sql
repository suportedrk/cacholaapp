-- Migration 079: RPC get_bi_lead_origin_breakdown
-- Agrega leads (ploomes_deals) por mês de criação e categoria de origem.
-- Mapeamento 13 origens cruas → 8 categorias lógicas vive aqui (única fonte da verdade).
-- Usado pelo painel BI "Origem dos Leads" na aba Visão Geral do /bi.

CREATE OR REPLACE FUNCTION public.get_bi_lead_origin_breakdown(
  p_unit_id       UUID,
  p_period_months INT DEFAULT 6
)
RETURNS TABLE (
  month_start DATE,
  category    TEXT,
  total       BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    DATE_TRUNC('month', d.ploomes_create_date)::DATE AS month_start,
    CASE
      WHEN d.origin_id IS NULL           THEN '(sem origem)'
      WHEN d.origin_id = 10003938        THEN 'Instagram'
      WHEN d.origin_id = 10046871        THEN 'Indicação'
      WHEN d.origin_id IN (60001628, 60001690) THEN 'Cliente recorrente'
      WHEN d.origin_id IN (10046775, 60001461) THEN 'WhatsApp'
      WHEN d.origin_id IN (10046776, 60029935) THEN 'Site/Web'
      WHEN d.origin_id = 60005995        THEN 'TikTok'
      ELSE                                    'Outros canais'
    END AS category,
    COUNT(*)::BIGINT AS total
  FROM public.ploomes_deals d
  WHERE d.unit_id = p_unit_id
    AND d.ploomes_create_date >= (NOW() - (p_period_months || ' months')::INTERVAL)
  GROUP BY 1, 2
  ORDER BY 1 ASC, 2 ASC;
$$;

COMMENT ON FUNCTION public.get_bi_lead_origin_breakdown(UUID, INT) IS
  'Agrega leads (deals do Ploomes) por mês de criação e categoria de origem (8 categorias derivadas '
  'das 13 origens cruas). Usado pelo painel BI Origem dos Leads. '
  'Mapeamento 13→8 vive aqui — única fonte da verdade. Migration 079.';

GRANT EXECUTE ON FUNCTION public.get_bi_lead_origin_breakdown(UUID, INT) TO authenticated;
