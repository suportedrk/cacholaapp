-- ============================================
-- Migration 043: RPCs para funil e comparativo de unidades
-- ============================================

-- ── Funil: distribuição dos deals por stage ──────────────────

CREATE OR REPLACE FUNCTION get_bi_funnel_data(
  p_unit_id UUID DEFAULT NULL
)
RETURNS TABLE (
  stage_id   BIGINT,
  stage_name TEXT,
  total      BIGINT,
  em_aberto  BIGINT,
  ganhos     BIGINT,
  perdidos   BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    pd.stage_id,
    pd.stage_name,
    COUNT(*)::BIGINT                                          AS total,
    COUNT(*) FILTER (WHERE pd.status_id = 1)::BIGINT         AS em_aberto,
    COUNT(*) FILTER (WHERE pd.status_id = 2)::BIGINT         AS ganhos,
    COUNT(*) FILTER (WHERE pd.status_id = 3)::BIGINT         AS perdidos
  FROM ploomes_deals pd
  WHERE (p_unit_id IS NULL OR pd.unit_id = p_unit_id)
  GROUP BY pd.stage_id, pd.stage_name
  ORDER BY total DESC;
$$;

GRANT EXECUTE ON FUNCTION get_bi_funnel_data TO authenticated;

COMMENT ON FUNCTION get_bi_funnel_data IS
  'Distribuição de deals por stage do pipeline para visualização do funil.
   Snapshot total acumulado (sem filtro de data).
   Won = status_id=2; Fest Fechada (stage_id=60004787) ganha via status.';

-- ── Comparativo entre unidades ───────────────────────────────

CREATE OR REPLACE FUNCTION get_bi_unit_comparison(
  p_months INTEGER DEFAULT 7
)
RETURNS TABLE (
  unit_id              UUID,
  unit_name            TEXT,
  total_leads          BIGINT,
  won_leads            BIGINT,
  conversion_rate      NUMERIC(5,2),
  total_revenue        NUMERIC(14,2),
  avg_ticket           NUMERIC(12,2),
  avg_closing_days     NUMERIC(6,1),
  avg_booking_advance  NUMERIC(6,1)
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    pd.unit_id,
    u.name AS unit_name,

    COUNT(*)::BIGINT AS total_leads,

    COUNT(*) FILTER (
      WHERE pd.status_id = 2 OR pd.stage_id = 60004787
    )::BIGINT AS won_leads,

    CASE WHEN COUNT(*) = 0 THEN NULL
    ELSE ROUND(
      COUNT(*) FILTER (WHERE pd.status_id = 2 OR pd.stage_id = 60004787)::NUMERIC
      / COUNT(*)::NUMERIC * 100, 2
    ) END AS conversion_rate,

    COALESCE(SUM(pd.deal_amount) FILTER (
      WHERE (pd.status_id = 2 OR pd.stage_id = 60004787) AND pd.deal_amount > 0
    ), 0)::NUMERIC(14,2) AS total_revenue,

    ROUND(AVG(pd.deal_amount) FILTER (
      WHERE (pd.status_id = 2 OR pd.stage_id = 60004787) AND pd.deal_amount > 0
    ), 2)::NUMERIC(12,2) AS avg_ticket,

    ROUND(AVG(
      EXTRACT(EPOCH FROM (pd.ploomes_last_update - pd.ploomes_create_date)) / 86400.0
    ) FILTER (
      WHERE (pd.status_id = 2 OR pd.stage_id = 60004787)
        AND pd.ploomes_last_update > pd.ploomes_create_date
    ), 1)::NUMERIC(6,1) AS avg_closing_days,

    ROUND(AVG(
      (pd.event_date - pd.ploomes_create_date::date)::INTEGER
    ) FILTER (
      WHERE (pd.status_id = 2 OR pd.stage_id = 60004787)
        AND pd.event_date IS NOT NULL
        AND pd.event_date > pd.ploomes_create_date::date
    ), 1)::NUMERIC(6,1) AS avg_booking_advance

  FROM ploomes_deals pd
  JOIN units u ON u.id = pd.unit_id
  WHERE pd.ploomes_create_date >= DATE_TRUNC('month', CURRENT_DATE) - (p_months || ' months')::INTERVAL
  GROUP BY pd.unit_id, u.name
  ORDER BY total_leads DESC;
$$;

GRANT EXECUTE ON FUNCTION get_bi_unit_comparison TO authenticated;

COMMENT ON FUNCTION get_bi_unit_comparison IS
  'Comparativo de métricas entre unidades nos últimos p_months meses.
   Ganho = status_id=2 OU stage_id=60004787 (Festa Fechada).
   Agrupado por unidade. avg_closing_days = proxy via ploomes_last_update.';
