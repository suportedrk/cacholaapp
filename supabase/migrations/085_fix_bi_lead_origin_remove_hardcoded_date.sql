-- Migration 085: Remove hardcoded start date from get_bi_lead_origin_breakdown
-- The filter `AND d.ploomes_create_date >= '2025-05-01'::DATE` was added in migration 080
-- to avoid empty bars for months before the origin backfill window. It silently blocked
-- historical analysis for periods > ~12 months and prevented showing pre-May/2025 data
-- even when explicitly requested. The dynamic p_period_months filter is sufficient.
-- Context: discovered during BI audit post-v1.6.7.

CREATE OR REPLACE FUNCTION public.get_bi_lead_origin_breakdown(
  p_unit_id      uuid,
  p_period_months integer DEFAULT 6
)
RETURNS TABLE(month_start date, category text, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    DATE_TRUNC('month', d.ploomes_create_date)::DATE AS month_start,
    CASE
      WHEN d.origin_id IS NULL                       THEN '(sem origem)'
      WHEN d.origin_id = 10003938                    THEN 'Instagram'
      WHEN d.origin_id = 10046871                    THEN 'Indicação'
      WHEN d.origin_id IN (60001628, 60001690)       THEN 'Cliente recorrente'
      WHEN d.origin_id IN (10046775, 60001461)       THEN 'WhatsApp'
      WHEN d.origin_id IN (10046776, 60029935)       THEN 'Site/Web'
      WHEN d.origin_id = 60005995                    THEN 'TikTok'
      ELSE                                               'Outros canais'
    END AS category,
    COUNT(*)::BIGINT AS total
  FROM public.ploomes_deals d
  WHERE d.unit_id = p_unit_id
    AND d.ploomes_create_date >= NOW() - (p_period_months || ' months')::INTERVAL
  GROUP BY 1, 2
  ORDER BY 1 ASC, 2 ASC;
$$;

NOTIFY pgrst, 'reload schema';
