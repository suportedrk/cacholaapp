-- ============================================================
-- Migration 118 — ROLLBACK
-- Restaura as 5 RPCs de BI ao estado pré-guard:
-- LANGUAGE sql, SECURITY DEFINER, sem IF NOT EXISTS ... RAISE EXCEPTION.
--
-- ⚠️ Aplicar ESTE rollback reabre o gap de segurança documentado.
--    Só usar se a migration 118 introduzir regressão funcional não-prevista.
-- ============================================================

BEGIN;

-- ── 1/5 — get_bi_conversion_data (volta para LANGUAGE sql) ─────

CREATE OR REPLACE FUNCTION public.get_bi_conversion_data(
  p_unit_id     UUID DEFAULT NULL,
  p_months      INTEGER DEFAULT 7,
  p_prev_start  DATE DEFAULT NULL,
  p_prev_end    DATE DEFAULT NULL
)
RETURNS TABLE(
  month                TEXT,
  total_leads          BIGINT,
  won_leads            BIGINT,
  conversion_rate      NUMERIC,
  prev_total_leads     BIGINT,
  prev_won_leads       BIGINT,
  prev_conversion_rate NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $function$
  WITH prev_agg AS (
    SELECT
      CASE WHEN p_prev_start IS NOT NULL AND p_prev_end IS NOT NULL
           THEN COUNT(*)
      END::BIGINT AS prev_total_leads,
      CASE WHEN p_prev_start IS NOT NULL AND p_prev_end IS NOT NULL
           THEN COUNT(*) FILTER (WHERE status_id = 2 OR stage_id = 60004787)
      END::BIGINT AS prev_won_leads,
      CASE WHEN p_prev_start IS NOT NULL AND p_prev_end IS NOT NULL
           THEN CASE
                  WHEN COUNT(*) = 0 THEN NULL
                  ELSE ROUND(
                    COUNT(*) FILTER (WHERE status_id = 2 OR stage_id = 60004787)::NUMERIC
                    / COUNT(*)::NUMERIC * 100,
                    2
                  )
                END
      END::NUMERIC(5,2) AS prev_conversion_rate
    FROM ploomes_deals
    WHERE (p_unit_id IS NULL OR unit_id = p_unit_id)
      AND ploomes_create_date::date BETWEEN
          COALESCE(p_prev_start, 'infinity'::date) AND
          COALESCE(p_prev_end,   '-infinity'::date)
  )
  SELECT
    TO_CHAR(ploomes_create_date, 'YYYY-MM') AS month,
    COUNT(*)::BIGINT AS total_leads,
    COUNT(*) FILTER (
      WHERE status_id = 2 OR stage_id = 60004787
    )::BIGINT AS won_leads,
    CASE
      WHEN COUNT(*) = 0 THEN NULL
      ELSE ROUND(
        COUNT(*) FILTER (
          WHERE status_id = 2 OR stage_id = 60004787
        )::NUMERIC / COUNT(*)::NUMERIC * 100,
        2
      )
    END AS conversion_rate,
    pa.prev_total_leads,
    pa.prev_won_leads,
    pa.prev_conversion_rate
  FROM ploomes_deals
  LEFT JOIN prev_agg pa ON true
  WHERE
    (p_unit_id IS NULL OR unit_id = p_unit_id)
    AND ploomes_create_date >= DATE_TRUNC('month', CURRENT_DATE) - (p_months || ' months')::INTERVAL
  GROUP BY
    TO_CHAR(ploomes_create_date, 'YYYY-MM'),
    pa.prev_total_leads,
    pa.prev_won_leads,
    pa.prev_conversion_rate
  ORDER BY month DESC;
$function$;

-- ── 2/5 — get_bi_funnel_data ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_bi_funnel_data(
  p_unit_id UUID DEFAULT NULL
)
RETURNS TABLE(
  stage_id    BIGINT,
  stage_name  TEXT,
  total       BIGINT,
  em_aberto   BIGINT,
  ganhos      BIGINT,
  perdidos    BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    pd.stage_id,
    pd.stage_name,
    COUNT(*)::BIGINT                                                            AS total,
    COUNT(*) FILTER (WHERE pd.status_id = 1)::BIGINT                           AS em_aberto,
    COUNT(*) FILTER (WHERE pd.status_id = 2 OR pd.stage_id = 60004787)::BIGINT AS ganhos,
    COUNT(*) FILTER (WHERE pd.status_id = 3)::BIGINT                           AS perdidos
  FROM public.ploomes_deals pd
  WHERE (p_unit_id IS NULL OR pd.unit_id = p_unit_id)
  GROUP BY pd.stage_id, pd.stage_name
  ORDER BY total DESC;
$function$;

-- ── 3/5 — get_bi_lead_origin_breakdown ─────────────────────────

CREATE OR REPLACE FUNCTION public.get_bi_lead_origin_breakdown(
  p_unit_id        UUID,
  p_period_months  INTEGER DEFAULT 6
)
RETURNS TABLE(
  month_start DATE,
  category    TEXT,
  total       BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

-- ── 4/5 — get_bi_sales_metrics ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_bi_sales_metrics(
  p_unit_id     UUID DEFAULT NULL,
  p_months      INTEGER DEFAULT 7,
  p_prev_start  DATE DEFAULT NULL,
  p_prev_end    DATE DEFAULT NULL
)
RETURNS TABLE(
  month                     TEXT,
  won_deals                 BIGINT,
  total_revenue             NUMERIC,
  avg_ticket                NUMERIC,
  avg_closing_days          NUMERIC,
  avg_booking_advance_days  NUMERIC,
  prev_revenue              NUMERIC,
  prev_won_deals            BIGINT,
  prev_avg_ticket           NUMERIC,
  prev_avg_closing_days     NUMERIC,
  prev_avg_advance_days     NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH prods AS (
    SELECT
      po.deal_id,
      COALESCE(SUM(pop.total), 0) AS soma_prod
    FROM ploomes_orders po
    LEFT JOIN ploomes_order_products pop ON pop.order_id = po.ploomes_order_id
    GROUP BY po.deal_id
  ),
  prev_agg AS (
    SELECT
      CASE WHEN p_prev_start IS NOT NULL AND p_prev_end IS NOT NULL
           THEN SUM(pr.soma_prod) FILTER (
                  WHERE (pd.status_id = 2 OR pd.stage_id = 60004787) AND pr.soma_prod > 0
                )
      END::NUMERIC(14,2) AS prev_revenue,
      CASE WHEN p_prev_start IS NOT NULL AND p_prev_end IS NOT NULL
           THEN COUNT(*) FILTER (WHERE pd.status_id = 2 OR pd.stage_id = 60004787)
      END::BIGINT AS prev_won_deals,
      CASE WHEN p_prev_start IS NOT NULL AND p_prev_end IS NOT NULL
           THEN ROUND(AVG(pr.soma_prod) FILTER (
                  WHERE (pd.status_id = 2 OR pd.stage_id = 60004787) AND pr.soma_prod > 0
                ), 2)
      END::NUMERIC(12,2) AS prev_avg_ticket,
      CASE WHEN p_prev_start IS NOT NULL AND p_prev_end IS NOT NULL
           THEN ROUND(AVG(
                  EXTRACT(EPOCH FROM (pd.ploomes_last_update - pd.ploomes_create_date)) / 86400.0
                ) FILTER (
                  WHERE (pd.status_id = 2 OR pd.stage_id = 60004787)
                    AND pd.ploomes_last_update IS NOT NULL
                    AND pd.ploomes_last_update > pd.ploomes_create_date
                ), 1)
      END::NUMERIC(6,1) AS prev_avg_closing_days,
      CASE WHEN p_prev_start IS NOT NULL AND p_prev_end IS NOT NULL
           THEN ROUND(AVG(
                  (pd.event_date - pd.ploomes_create_date::date)::INTEGER
                ) FILTER (
                  WHERE (pd.status_id = 2 OR pd.stage_id = 60004787)
                    AND pd.event_date IS NOT NULL
                    AND pd.event_date > pd.ploomes_create_date::date
                ), 1)
      END::NUMERIC(6,1) AS prev_avg_advance_days
    FROM ploomes_deals pd
    LEFT JOIN prods pr ON pr.deal_id = pd.ploomes_deal_id
    WHERE (p_unit_id IS NULL OR pd.unit_id = p_unit_id)
      AND pd.ploomes_create_date::date BETWEEN
          COALESCE(p_prev_start, 'infinity'::date) AND
          COALESCE(p_prev_end,   '-infinity'::date)
  )
  SELECT
    TO_CHAR(pd.ploomes_create_date, 'YYYY-MM') AS month,
    COUNT(*) FILTER (
      WHERE pd.status_id = 2 OR pd.stage_id = 60004787
    )::BIGINT AS won_deals,
    CASE WHEN can_view_festa_values()
      THEN COALESCE(SUM(pr.soma_prod) FILTER (
             WHERE (pd.status_id = 2 OR pd.stage_id = 60004787) AND pr.soma_prod > 0
           ), 0)::NUMERIC(14,2)
      ELSE NULL
    END AS total_revenue,
    CASE WHEN can_view_festa_values()
      THEN ROUND(AVG(pr.soma_prod) FILTER (
             WHERE (pd.status_id = 2 OR pd.stage_id = 60004787) AND pr.soma_prod > 0
           ), 2)::NUMERIC(12,2)
      ELSE NULL
    END AS avg_ticket,
    ROUND(AVG(
      EXTRACT(EPOCH FROM (pd.ploomes_last_update - pd.ploomes_create_date)) / 86400.0
    ) FILTER (
      WHERE (pd.status_id = 2 OR pd.stage_id = 60004787)
        AND pd.ploomes_last_update IS NOT NULL
        AND pd.ploomes_last_update > pd.ploomes_create_date
    ), 1)::NUMERIC(6,1) AS avg_closing_days,
    ROUND(AVG(
      (pd.event_date - pd.ploomes_create_date::date)::INTEGER
    ) FILTER (
      WHERE (pd.status_id = 2 OR pd.stage_id = 60004787)
        AND pd.event_date IS NOT NULL
        AND pd.event_date > pd.ploomes_create_date::date
    ), 1)::NUMERIC(6,1) AS avg_booking_advance_days,
    CASE WHEN can_view_festa_values() THEN pa.prev_revenue      ELSE NULL END AS prev_revenue,
    pa.prev_won_deals,
    CASE WHEN can_view_festa_values() THEN pa.prev_avg_ticket   ELSE NULL END AS prev_avg_ticket,
    pa.prev_avg_closing_days,
    pa.prev_avg_advance_days
  FROM ploomes_deals pd
  LEFT JOIN prods pr ON pr.deal_id = pd.ploomes_deal_id
  LEFT JOIN prev_agg pa ON true
  WHERE
    (p_unit_id IS NULL OR pd.unit_id = p_unit_id)
    AND pd.ploomes_create_date >= DATE_TRUNC('month', CURRENT_DATE) - (p_months || ' months')::INTERVAL
  GROUP BY
    TO_CHAR(pd.ploomes_create_date, 'YYYY-MM'),
    pa.prev_revenue,
    pa.prev_won_deals,
    pa.prev_avg_ticket,
    pa.prev_avg_closing_days,
    pa.prev_avg_advance_days
  ORDER BY month DESC;
$function$;

-- ── 5/5 — get_bi_unit_comparison ───────────────────────────────

CREATE OR REPLACE FUNCTION public.get_bi_unit_comparison(
  p_months INTEGER DEFAULT 7
)
RETURNS TABLE(
  unit_id              UUID,
  unit_name            TEXT,
  total_leads          BIGINT,
  won_leads            BIGINT,
  conversion_rate      NUMERIC,
  total_revenue        NUMERIC,
  avg_ticket           NUMERIC,
  avg_closing_days     NUMERIC,
  avg_booking_advance  NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH prods AS (
    SELECT
      po.deal_id,
      COALESCE(SUM(pop.total), 0) AS soma_prod
    FROM ploomes_orders po
    LEFT JOIN ploomes_order_products pop ON pop.order_id = po.ploomes_order_id
    GROUP BY po.deal_id
  )
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
    CASE WHEN can_view_festa_values()
      THEN COALESCE(SUM(pr.soma_prod) FILTER (
             WHERE (pd.status_id = 2 OR pd.stage_id = 60004787) AND pr.soma_prod > 0
           ), 0)::NUMERIC(14,2)
      ELSE NULL
    END AS total_revenue,
    CASE WHEN can_view_festa_values()
      THEN ROUND(AVG(pr.soma_prod) FILTER (
             WHERE (pd.status_id = 2 OR pd.stage_id = 60004787) AND pr.soma_prod > 0
           ), 2)::NUMERIC(12,2)
      ELSE NULL
    END AS avg_ticket,
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
  LEFT JOIN prods pr ON pr.deal_id = pd.ploomes_deal_id
  WHERE pd.ploomes_create_date >= DATE_TRUNC('month', CURRENT_DATE) - (p_months || ' months')::INTERVAL
  GROUP BY pd.unit_id, u.name
  ORDER BY total_leads DESC;
$function$;

COMMIT;

NOTIFY pgrst, 'reload schema';
