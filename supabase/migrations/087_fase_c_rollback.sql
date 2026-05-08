-- =============================================================
-- Migration 087 — ROLLBACK
-- Restaura as 11 RPCs para o estado anterior à Fase C
-- (migrations 042, 043, 051 originais; 059 na versão da migration 068)
-- USAR SOMENTE SE NECESSÁRIO REVERTER A 087
-- =============================================================

BEGIN;

-- 1. get_bi_sales_metrics (restaura migration 042)
CREATE OR REPLACE FUNCTION get_bi_sales_metrics(
  p_unit_id UUID DEFAULT NULL,
  p_months  INTEGER DEFAULT 7
)
RETURNS TABLE (
  month                     TEXT,
  won_deals                 BIGINT,
  total_revenue             NUMERIC(14,2),
  avg_ticket                NUMERIC(12,2),
  avg_closing_days          NUMERIC(6,1),
  avg_booking_advance_days  NUMERIC(6,1)
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    TO_CHAR(ploomes_create_date, 'YYYY-MM') AS month,
    COUNT(*) FILTER (
      WHERE status_id = 2 OR stage_id = 60004787
    )::BIGINT AS won_deals,
    COALESCE(SUM(deal_amount) FILTER (
      WHERE (status_id = 2 OR stage_id = 60004787)
        AND deal_amount > 0
    ), 0)::NUMERIC(14,2) AS total_revenue,
    ROUND(
      AVG(deal_amount) FILTER (
        WHERE (status_id = 2 OR stage_id = 60004787)
          AND deal_amount > 0
      ), 2
    )::NUMERIC(12,2) AS avg_ticket,
    ROUND(
      AVG(
        EXTRACT(EPOCH FROM (ploomes_last_update - ploomes_create_date)) / 86400.0
      ) FILTER (
        WHERE (status_id = 2 OR stage_id = 60004787)
          AND ploomes_last_update IS NOT NULL
          AND ploomes_last_update > ploomes_create_date
      ), 1
    )::NUMERIC(6,1) AS avg_closing_days,
    ROUND(
      AVG(
        (event_date - ploomes_create_date::date)::INTEGER
      ) FILTER (
        WHERE (status_id = 2 OR stage_id = 60004787)
          AND event_date IS NOT NULL
          AND event_date > ploomes_create_date::date
      ), 1
    )::NUMERIC(6,1) AS avg_booking_advance_days
  FROM ploomes_deals
  WHERE
    (p_unit_id IS NULL OR unit_id = p_unit_id)
    AND ploomes_create_date >= DATE_TRUNC('month', CURRENT_DATE) - (p_months || ' months')::INTERVAL
  GROUP BY TO_CHAR(ploomes_create_date, 'YYYY-MM')
  ORDER BY month DESC;
$$;

GRANT EXECUTE ON FUNCTION get_bi_sales_metrics TO authenticated;


-- 2. get_bi_unit_comparison (restaura migration 043)
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


-- 3. get_bi_sellers_ranking (restaura migration 051 — critério status_id=2 original)
CREATE OR REPLACE FUNCTION public.get_bi_sellers_ranking(
  p_unit_id       UUID    DEFAULT NULL,
  p_period_months INTEGER DEFAULT 6
)
RETURNS TABLE (
  owner_name      TEXT,
  leads_count     BIGINT,
  won_count       BIGINT,
  lost_count      BIGINT,
  open_count      BIGINT,
  conversion_rate NUMERIC,
  avg_ticket      NUMERIC,
  total_revenue   NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_date DATE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'diretor')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  v_start_date := CURRENT_DATE - (p_period_months || ' months')::INTERVAL;

  RETURN QUERY
  SELECT
    pd.owner_name,
    COUNT(*)::BIGINT                                                           AS leads_count,
    COUNT(*) FILTER (WHERE pd.status_id = 2)::BIGINT                          AS won_count,
    COUNT(*) FILTER (WHERE pd.status_id = 3)::BIGINT                          AS lost_count,
    COUNT(*) FILTER (WHERE pd.status_id = 1)::BIGINT                          AS open_count,
    CASE
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND(
        COUNT(*) FILTER (WHERE pd.status_id = 2)::NUMERIC
        / COUNT(*)::NUMERIC * 100, 1
      )
    END                                                                        AS conversion_rate,
    COALESCE(AVG(pd.deal_amount) FILTER (WHERE pd.status_id = 2), 0)::NUMERIC AS avg_ticket,
    COALESCE(SUM(pd.deal_amount) FILTER (WHERE pd.status_id = 2), 0)::NUMERIC AS total_revenue
  FROM public.ploomes_deals pd
  WHERE pd.owner_name IS NOT NULL
    AND pd.ploomes_create_date >= v_start_date
    AND (p_unit_id IS NULL OR pd.unit_id = p_unit_id)
  GROUP BY pd.owner_name
  ORDER BY total_revenue DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_bi_sellers_ranking(UUID, INTEGER) TO authenticated;


-- 4. get_bi_seller_history (restaura migration 051 — critério status_id=2 original)
CREATE OR REPLACE FUNCTION public.get_bi_seller_history(
  p_owner_name    TEXT,
  p_unit_id       UUID    DEFAULT NULL,
  p_period_months INTEGER DEFAULT 6
)
RETURNS TABLE (
  month_label        TEXT,
  leads_count        BIGINT,
  won_count          BIGINT,
  revenue            NUMERIC,
  avg_days_to_close  NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_date DATE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'diretor')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  v_start_date := DATE_TRUNC('month',
    CURRENT_DATE - (p_period_months || ' months')::INTERVAL
  );

  RETURN QUERY
  SELECT
    TO_CHAR(DATE_TRUNC('month', pd.ploomes_create_date), 'YYYY-MM') AS month_label,
    COUNT(*)::BIGINT                                                 AS leads_count,
    COUNT(*) FILTER (WHERE pd.status_id = 2)::BIGINT                AS won_count,
    COALESCE(
      SUM(pd.deal_amount) FILTER (WHERE pd.status_id = 2), 0
    )::NUMERIC                                                       AS revenue,
    ROUND(
      AVG(
        EXTRACT(EPOCH FROM (pd.ploomes_last_update - pd.ploomes_create_date)) / 86400.0
      ) FILTER (WHERE pd.status_id = 2),
      1
    )::NUMERIC                                                       AS avg_days_to_close
  FROM public.ploomes_deals pd
  WHERE pd.owner_name = p_owner_name
    AND pd.ploomes_create_date >= v_start_date
    AND (p_unit_id IS NULL OR pd.unit_id = p_unit_id)
  GROUP BY DATE_TRUNC('month', pd.ploomes_create_date)
  ORDER BY DATE_TRUNC('month', pd.ploomes_create_date);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_bi_seller_history(TEXT, UUID, INTEGER) TO authenticated;


-- 5. get_bi_seller_funnel (restaura migration 051 — GROUP BY status_id original)
CREATE OR REPLACE FUNCTION public.get_bi_seller_funnel(
  p_owner_name    TEXT,
  p_unit_id       UUID    DEFAULT NULL,
  p_period_months INTEGER DEFAULT 6
)
RETURNS TABLE (
  bucket       TEXT,
  deals_count  BIGINT,
  total_value  NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_date DATE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'diretor')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  v_start_date := CURRENT_DATE - (p_period_months || ' months')::INTERVAL;

  RETURN QUERY
  SELECT
    CASE pd.status_id
      WHEN 1 THEN 'em_aberto'
      WHEN 2 THEN 'ganhos'
      WHEN 3 THEN 'perdidos'
    END::TEXT                                  AS bucket,
    COUNT(*)::BIGINT                           AS deals_count,
    COALESCE(SUM(pd.deal_amount), 0)::NUMERIC  AS total_value
  FROM public.ploomes_deals pd
  WHERE pd.owner_name = p_owner_name
    AND pd.ploomes_create_date >= v_start_date
    AND pd.status_id IN (1, 2, 3)
    AND (p_unit_id IS NULL OR pd.unit_id = p_unit_id)
  GROUP BY pd.status_id
  ORDER BY pd.status_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_bi_seller_funnel(TEXT, UUID, INTEGER) TO authenticated;


-- 6. get_bi_sales_kpi (restaura migration 055 original)
CREATE OR REPLACE FUNCTION public.get_bi_sales_kpi(
  p_start_date        DATE,
  p_end_date          DATE,
  p_unit_id           UUID    DEFAULT NULL,
  p_include_inactive  BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  total_revenue  NUMERIC,
  total_orders   BIGINT,
  avg_ticket     NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'diretor', 'gerente', 'financeiro')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(po.amount), 0)::NUMERIC                              AS total_revenue,
    COUNT(*)::BIGINT                                                   AS total_orders,
    CASE WHEN COUNT(*) > 0
         THEN (COALESCE(SUM(po.amount), 0) / COUNT(*))::NUMERIC
         ELSE 0::NUMERIC
    END                                                                AS avg_ticket
  FROM ploomes_orders po
  JOIN sellers s ON s.owner_id = po.owner_id
  WHERE po.date BETWEEN p_start_date AND p_end_date
    AND (p_unit_id IS NULL OR po.unit_id = p_unit_id)
    AND (p_include_inactive OR (s.status = 'active' AND s.is_system_account = FALSE));
END;
$$;


-- 7. get_bi_sales_ranking (restaura migration 055 original)
CREATE OR REPLACE FUNCTION public.get_bi_sales_ranking(
  p_start_date        DATE,
  p_end_date          DATE,
  p_unit_id           UUID    DEFAULT NULL,
  p_include_inactive  BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  seller_id            UUID,
  seller_name          TEXT,
  seller_status        TEXT,
  is_system_account    BOOLEAN,
  hire_date            DATE,
  termination_date     DATE,
  total_revenue        NUMERIC,
  order_count          BIGINT,
  avg_ticket           NUMERIC,
  months_worked        NUMERIC,
  avg_monthly_revenue  NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'diretor', 'gerente', 'financeiro')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  RETURN QUERY
  WITH filtered_sellers AS (
    SELECT
      s.id,
      s.name,
      s.status,
      s.is_system_account,
      s.hire_date,
      s.termination_date,
      s.owner_id,
      GREATEST(COALESCE(s.hire_date, p_start_date), p_start_date) AS eff_start,
      LEAST(COALESCE(s.termination_date, p_end_date), p_end_date) AS eff_end
    FROM sellers s
    WHERE (p_include_inactive OR (s.status = 'active' AND s.is_system_account = FALSE))
      AND COALESCE(s.hire_date, p_start_date) <= p_end_date
  ),
  aggregated AS (
    SELECT
      fs.id                                          AS seller_id,
      fs.name                                        AS seller_name,
      fs.status,
      fs.is_system_account,
      fs.hire_date,
      fs.termination_date,
      fs.eff_start,
      fs.eff_end,
      COALESCE(SUM(po.amount), 0)::NUMERIC           AS total_revenue,
      COUNT(po.ploomes_order_id)::BIGINT             AS order_count
    FROM filtered_sellers fs
    LEFT JOIN ploomes_orders po
      ON po.owner_id = fs.owner_id
     AND po.date BETWEEN p_start_date AND p_end_date
     AND (p_unit_id IS NULL OR po.unit_id = p_unit_id)
    GROUP BY
      fs.id, fs.name, fs.status, fs.is_system_account,
      fs.hire_date, fs.termination_date, fs.eff_start, fs.eff_end
  )
  SELECT
    a.seller_id,
    a.seller_name,
    a.status                                                           AS seller_status,
    a.is_system_account,
    a.hire_date,
    a.termination_date,
    a.total_revenue,
    a.order_count,
    CASE WHEN a.order_count > 0
         THEN a.total_revenue / a.order_count
         ELSE 0::NUMERIC
    END                                                                AS avg_ticket,
    GREATEST(1.0, (a.eff_end - a.eff_start)::NUMERIC / 30.4375)       AS months_worked,
    CASE WHEN a.total_revenue > 0
         THEN a.total_revenue / GREATEST(1.0, (a.eff_end - a.eff_start)::NUMERIC / 30.4375)
         ELSE 0::NUMERIC
    END                                                                AS avg_monthly_revenue
  FROM aggregated a
  ORDER BY a.total_revenue DESC;
END;
$$;


-- 8. get_bi_seller_orders (restaura migration 055 original)
CREATE OR REPLACE FUNCTION public.get_bi_seller_orders(
  p_seller_id   UUID,
  p_start_date  DATE,
  p_end_date    DATE,
  p_unit_id     UUID DEFAULT NULL
)
RETURNS TABLE (
  ploomes_order_id  BIGINT,
  order_date        DATE,
  amount            NUMERIC,
  deal_id           BIGINT,
  client_name       TEXT,
  unit_name         TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'diretor', 'gerente', 'financeiro')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    po.ploomes_order_id,
    po.date                                              AS order_date,
    po.amount,
    po.deal_id,
    COALESCE(po.contact_name, '—')::TEXT                AS client_name,
    COALESCE(u.name, '—')::TEXT                         AS unit_name
  FROM sellers s
  JOIN ploomes_orders po ON po.owner_id = s.owner_id
  LEFT JOIN units u ON u.id = po.unit_id
  WHERE s.id = p_seller_id
    AND po.date BETWEEN p_start_date AND p_end_date
    AND (p_unit_id IS NULL OR po.unit_id = p_unit_id)
  ORDER BY po.date DESC;
END;
$$;


-- 9. get_vendas_my_kpis (restaura migration 068 — versão pos_vendas)
CREATE OR REPLACE FUNCTION public.get_vendas_my_kpis(
  p_seller_id  UUID,
  p_start_date DATE,
  p_end_date   DATE,
  p_prev_start DATE,
  p_prev_end   DATE
)
RETURNS TABLE(
  total_revenue        NUMERIC,
  order_count          INTEGER,
  avg_ticket           NUMERIC,
  won_count            INTEGER,
  conversion_rate      NUMERIC,
  prev_revenue         NUMERIC,
  prev_order_count     INTEGER,
  prev_avg_ticket      NUMERIC,
  prev_won_count       INTEGER,
  prev_conversion_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role   TEXT;
  v_caller_seller UUID;
  v_eff_seller    UUID;
  v_owner_int     INTEGER;
BEGIN
  SELECT u.role, u.seller_id
    INTO v_caller_role, v_caller_seller
    FROM public.users u
   WHERE u.id = auth.uid();

  IF v_caller_role NOT IN ('super_admin', 'diretor', 'gerente', 'vendedora', 'pos_vendas') THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  IF v_caller_role = 'vendedora' THEN
    IF v_caller_seller IS NULL THEN
      RAISE EXCEPTION 'seller_not_linked';
    END IF;
    v_eff_seller := v_caller_seller;
  ELSE
    v_eff_seller := p_seller_id;
  END IF;

  IF v_eff_seller IS NOT NULL THEN
    SELECT s.owner_id INTO v_owner_int
      FROM public.sellers s WHERE s.id = v_eff_seller;
  END IF;

  RETURN QUERY
  WITH
  orders_agg AS (
    SELECT
      SUM(CASE WHEN po.date BETWEEN p_start_date AND p_end_date THEN po.amount ELSE 0 END)  AS curr_rev,
      COUNT(CASE WHEN po.date BETWEEN p_start_date AND p_end_date THEN 1 END)                AS curr_cnt,
      SUM(CASE WHEN po.date BETWEEN p_prev_start AND p_prev_end  THEN po.amount ELSE 0 END) AS prev_rev,
      COUNT(CASE WHEN po.date BETWEEN p_prev_start AND p_prev_end  THEN 1 END)               AS prev_cnt
    FROM public.ploomes_orders po
    WHERE po.date BETWEEN p_prev_start AND p_end_date
      AND (v_eff_seller IS NULL OR po.owner_id = v_owner_int)
  ),
  deals_agg AS (
    SELECT
      COUNT(CASE WHEN pd.ploomes_create_date::date BETWEEN p_start_date AND p_end_date
                  AND (pd.status_id = 2 OR pd.stage_id = 60004787) THEN 1 END)             AS curr_won,
      COUNT(CASE WHEN pd.ploomes_create_date::date BETWEEN p_start_date AND p_end_date
                 THEN 1 END)                                                                AS curr_total,
      COUNT(CASE WHEN pd.ploomes_create_date::date BETWEEN p_prev_start AND p_prev_end
                  AND (pd.status_id = 2 OR pd.stage_id = 60004787) THEN 1 END)            AS prev_won,
      COUNT(CASE WHEN pd.ploomes_create_date::date BETWEEN p_prev_start AND p_prev_end
                 THEN 1 END)                                                                AS prev_total
    FROM public.ploomes_deals pd
    WHERE pd.ploomes_create_date::date BETWEEN p_prev_start AND p_end_date
      AND (v_eff_seller IS NULL OR pd.owner_id = v_owner_int)
  )
  SELECT
    COALESCE(oa.curr_rev, 0)::NUMERIC,
    COALESCE(oa.curr_cnt, 0)::INTEGER,
    CASE WHEN COALESCE(oa.curr_cnt, 0) > 0
         THEN (oa.curr_rev / oa.curr_cnt)::NUMERIC ELSE 0::NUMERIC END,
    COALESCE(da.curr_won, 0)::INTEGER,
    CASE WHEN COALESCE(da.curr_total, 0) > 0
         THEN (da.curr_won::NUMERIC / da.curr_total * 100)::NUMERIC ELSE 0::NUMERIC END,
    COALESCE(oa.prev_rev, 0)::NUMERIC,
    COALESCE(oa.prev_cnt, 0)::INTEGER,
    CASE WHEN COALESCE(oa.prev_cnt, 0) > 0
         THEN (oa.prev_rev / oa.prev_cnt)::NUMERIC ELSE 0::NUMERIC END,
    COALESCE(da.prev_won, 0)::INTEGER,
    CASE WHEN COALESCE(da.prev_total, 0) > 0
         THEN (da.prev_won::NUMERIC / da.prev_total * 100)::NUMERIC ELSE 0::NUMERIC END
  FROM orders_agg oa, deals_agg da;
END;
$$;


-- 10. get_vendas_daily_revenue (restaura migration 068 — versão pos_vendas)
CREATE OR REPLACE FUNCTION public.get_vendas_daily_revenue(
  p_seller_id  UUID,
  p_start_date DATE,
  p_end_date   DATE
)
RETURNS TABLE(
  order_date         DATE,
  revenue            NUMERIC,
  cumulative_revenue NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role   TEXT;
  v_caller_seller UUID;
  v_eff_seller    UUID;
  v_owner_int     INTEGER;
BEGIN
  SELECT u.role, u.seller_id
    INTO v_caller_role, v_caller_seller
    FROM public.users u
   WHERE u.id = auth.uid();

  IF v_caller_role NOT IN ('super_admin', 'diretor', 'gerente', 'vendedora', 'pos_vendas') THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  IF v_caller_role = 'vendedora' THEN
    IF v_caller_seller IS NULL THEN
      RAISE EXCEPTION 'seller_not_linked';
    END IF;
    v_eff_seller := v_caller_seller;
  ELSE
    v_eff_seller := p_seller_id;
  END IF;

  IF v_eff_seller IS NOT NULL THEN
    SELECT s.owner_id INTO v_owner_int
      FROM public.sellers s WHERE s.id = v_eff_seller;
  END IF;

  RETURN QUERY
  SELECT
    po.date::DATE                                                    AS order_date,
    SUM(po.amount)::NUMERIC                                          AS revenue,
    SUM(SUM(po.amount)) OVER (ORDER BY po.date)::NUMERIC             AS cumulative_revenue
  FROM public.ploomes_orders po
  WHERE po.date BETWEEN p_start_date AND p_end_date
    AND (v_eff_seller IS NULL OR po.owner_id = v_owner_int)
  GROUP BY po.date
  ORDER BY po.date;
END;
$$;


-- 11. get_vendas_ranking (restaura migration 068 — versão pos_vendas com deals_by_owner)
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
      AND role IN ('super_admin', 'diretor', 'gerente', 'vendedora', 'pos_vendas')
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
