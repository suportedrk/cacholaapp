-- =============================================================
-- Migration 060: Estende get_vendas_ranking com deals_won + conversion_rate
-- RETURNS TABLE schema change → DROP + CREATE obrigatório
-- =============================================================

BEGIN;

DROP FUNCTION IF EXISTS public.get_vendas_ranking(DATE, DATE, UUID);

CREATE FUNCTION public.get_vendas_ranking(
  p_start_date DATE,
  p_end_date   DATE,
  p_unit_id    UUID DEFAULT NULL
)
RETURNS TABLE(
  seller_id       UUID,
  seller_name     TEXT,
  total_revenue   NUMERIC,
  order_count     INTEGER,
  avg_ticket      NUMERIC,
  deals_won       INTEGER,
  conversion_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'diretor', 'gerente', 'vendedora')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  RETURN QUERY
  WITH
  ranked_sellers AS (
    SELECT
      s.id                                                               AS seller_id,
      s.name                                                             AS seller_name,
      s.owner_id                                                         AS s_owner_id,
      COALESCE(SUM(po.amount), 0)::NUMERIC                               AS total_revenue,
      COUNT(po.ploomes_order_id)::INTEGER                                AS order_count
    FROM public.sellers s
    LEFT JOIN public.ploomes_orders po
      ON po.owner_id = s.owner_id
     AND po.date BETWEEN p_start_date AND p_end_date
     AND (p_unit_id IS NULL OR po.unit_id = p_unit_id)
    WHERE s.status = 'active'
      AND s.is_system_account = FALSE
    GROUP BY s.id, s.name, s.owner_id
  ),
  deals_by_owner AS (
    SELECT
      pd.owner_id,
      COUNT(CASE WHEN pd.status_id = 2 OR pd.stage_id = 60004787
                 THEN 1 END)::INTEGER AS deals_won,
      COUNT(*)::INTEGER               AS deals_total
    FROM public.ploomes_deals pd
    WHERE pd.ploomes_create_date::date BETWEEN p_start_date AND p_end_date
    GROUP BY pd.owner_id
  )
  SELECT
    rs.seller_id,
    rs.seller_name,
    rs.total_revenue,
    rs.order_count,
    CASE WHEN rs.order_count > 0
         THEN (rs.total_revenue / rs.order_count)::NUMERIC
         ELSE 0::NUMERIC
    END                                                                  AS avg_ticket,
    COALESCE(dbo.deals_won, 0)::INTEGER                                  AS deals_won,
    CASE WHEN COALESCE(dbo.deals_total, 0) > 0
         THEN (COALESCE(dbo.deals_won, 0)::NUMERIC / dbo.deals_total * 100)::NUMERIC
         ELSE 0::NUMERIC
    END                                                                  AS conversion_rate
  FROM ranked_sellers rs
  LEFT JOIN deals_by_owner dbo ON dbo.owner_id = rs.s_owner_id
  ORDER BY rs.total_revenue DESC;
END;
$$;

COMMIT;
