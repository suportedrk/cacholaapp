-- =============================================================
-- Migration 059: Vendas — RPCs Meu Painel
-- get_vendas_my_kpis, get_vendas_daily_revenue, get_vendas_ranking
-- Guardados por role: super_admin, diretor, gerente, vendedora
-- =============================================================

BEGIN;

-- ---------------------------------------------------------------
-- RPC 1: KPIs do período atual + anterior (para delta)
-- p_seller_id NULL → agrega todas (gestores); vendedora → forçado
-- ---------------------------------------------------------------
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

  IF v_caller_role NOT IN ('super_admin', 'diretor', 'gerente', 'vendedora') THEN
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

-- ---------------------------------------------------------------
-- RPC 2: Série diária de receita (para gráfico de acumulado)
-- ---------------------------------------------------------------
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

  IF v_caller_role NOT IN ('super_admin', 'diretor', 'gerente', 'vendedora') THEN
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

-- ---------------------------------------------------------------
-- RPC 3: Ranking de vendedoras ativas (acessível por vendedoras)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_vendas_ranking(
  p_start_date DATE,
  p_end_date   DATE,
  p_unit_id    UUID DEFAULT NULL
)
RETURNS TABLE(
  seller_id     UUID,
  seller_name   TEXT,
  total_revenue NUMERIC,
  order_count   INTEGER,
  avg_ticket    NUMERIC
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
  SELECT
    s.id                                                               AS seller_id,
    s.name                                                             AS seller_name,
    COALESCE(SUM(po.amount), 0)::NUMERIC                               AS total_revenue,
    COUNT(po.ploomes_order_id)::INTEGER                                AS order_count,
    CASE WHEN COUNT(po.ploomes_order_id) > 0
         THEN (SUM(po.amount) / COUNT(po.ploomes_order_id))::NUMERIC
         ELSE 0::NUMERIC
    END                                                                AS avg_ticket
  FROM public.sellers s
  LEFT JOIN public.ploomes_orders po
    ON po.owner_id = s.owner_id
   AND po.date BETWEEN p_start_date AND p_end_date
   AND (p_unit_id IS NULL OR po.unit_id = p_unit_id)
  WHERE s.status = 'active'
    AND s.is_system_account = FALSE
  GROUP BY s.id, s.name
  ORDER BY total_revenue DESC;
END;
$$;

COMMIT;
