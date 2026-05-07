-- Migration 086: Align get_bi_funnel_data "ganhos" criterion with all other BI RPCs
-- Previously counted only status_id = 2 (Ganho). All other RPCs (get_bi_conversion_data,
-- get_bi_sales_metrics, get_bi_sellers_ranking, etc.) count as won:
--   status_id = 2 OR stage_id = 60004787 (Festa Fechada)
-- This inconsistency caused the funnel "Ganhos" count to diverge from the
-- Conversão/Vendas tabs, confusing users comparing the two views.
-- Also adds SET search_path to match project standards.

CREATE OR REPLACE FUNCTION public.get_bi_funnel_data(p_unit_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(
  stage_id   bigint,
  stage_name text,
  total      bigint,
  em_aberto  bigint,
  ganhos     bigint,
  perdidos   bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    pd.stage_id,
    pd.stage_name,
    COUNT(*)::BIGINT                                                                         AS total,
    COUNT(*) FILTER (WHERE pd.status_id = 1)::BIGINT                                        AS em_aberto,
    COUNT(*) FILTER (WHERE pd.status_id = 2 OR pd.stage_id = 60004787)::BIGINT              AS ganhos,
    COUNT(*) FILTER (WHERE pd.status_id = 3)::BIGINT                                        AS perdidos
  FROM public.ploomes_deals pd
  WHERE (p_unit_id IS NULL OR pd.unit_id = p_unit_id)
  GROUP BY pd.stage_id, pd.stage_name
  ORDER BY total DESC;
$$;

NOTIFY pgrst, 'reload schema';
