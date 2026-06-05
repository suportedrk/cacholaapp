-- ============================================================
-- Migration 151 — RPCs: critério canônico + unidade da festa (Fase 3b)
-- ============================================================
-- (A) Critério de ganho → is_festa_ganha(status_id, stage_id) em 9 RPCs.
-- (B) Unidade da festa:
--     - unit_comparison: base mista (leads/conv=pretendida; won/tempos=events.unit_id;
--       receita=pop.unit_id).
--     - sales_metrics: won/tempos=events.unit_id; valor=pop.unit_id.
--     - sales_kpi/sales_ranking: filtro de unidade por resolve_festa_unit em grão de Order.
--     - seller_history/sellers_ranking/vendas_ranking: receita pela festa (pop.unit_id /
--       order-grain), contagens/conversão pela pretendida.
--     - conversion_data/funnel_data/seller_funnel/vendas_my_kpis: só o novo critério.
--
-- Guarda cartesiana: receita por unidade sempre via CTE pré-agregada (deal_id, pop.unit_id).
-- RETURNS TABLE de todas inalterado → CREATE OR REPLACE (sem DROP).
-- NÃO aplica backfill (21 produtos vêm na Fase 3c). resolve_festa_unit + escolhida_unit_id
-- e is_festa_ganha já existem (migrations 149/150).

BEGIN;

-- ════════════════════════════════════════════════════════════
-- CLUSTER 1 — apenas critério (unidade inalterada)
-- ════════════════════════════════════════════════════════════

-- 1) get_bi_conversion_data — critério no won_leads/conversão (pretendida intocada)
CREATE OR REPLACE FUNCTION public.get_bi_conversion_data(p_unit_id uuid DEFAULT NULL::uuid, p_months integer DEFAULT 7, p_prev_start date DEFAULT NULL::date, p_prev_end date DEFAULT NULL::date)
 RETURNS TABLE(month text, total_leads bigint, won_leads bigint, conversion_rate numeric, prev_total_leads bigint, prev_won_leads bigint, prev_conversion_rate numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.check_permission_or_raise('bi', 'view');

  RETURN QUERY
  WITH prev_agg AS (
    SELECT
      CASE WHEN p_prev_start IS NOT NULL AND p_prev_end IS NOT NULL THEN COUNT(*) END::BIGINT AS prev_total_leads,
      CASE WHEN p_prev_start IS NOT NULL AND p_prev_end IS NOT NULL
           THEN COUNT(*) FILTER (WHERE is_festa_ganha(status_id, stage_id)) END::BIGINT AS prev_won_leads,
      CASE WHEN p_prev_start IS NOT NULL AND p_prev_end IS NOT NULL
           THEN CASE WHEN COUNT(*) = 0 THEN NULL
                ELSE ROUND(COUNT(*) FILTER (WHERE is_festa_ganha(status_id, stage_id))::NUMERIC / COUNT(*)::NUMERIC * 100, 2) END
      END::NUMERIC(5,2) AS prev_conversion_rate
    FROM ploomes_deals
    WHERE (p_unit_id IS NULL OR unit_id = p_unit_id)
      AND ploomes_create_date::date BETWEEN COALESCE(p_prev_start, 'infinity'::date) AND COALESCE(p_prev_end, '-infinity'::date)
  )
  SELECT
    TO_CHAR(ploomes_create_date, 'YYYY-MM') AS month,
    COUNT(*)::BIGINT AS total_leads,
    COUNT(*) FILTER (WHERE is_festa_ganha(status_id, stage_id))::BIGINT AS won_leads,
    CASE WHEN COUNT(*) = 0 THEN NULL
         ELSE ROUND(COUNT(*) FILTER (WHERE is_festa_ganha(status_id, stage_id))::NUMERIC / COUNT(*)::NUMERIC * 100, 2) END AS conversion_rate,
    pa.prev_total_leads, pa.prev_won_leads, pa.prev_conversion_rate
  FROM ploomes_deals
  LEFT JOIN prev_agg pa ON true
  WHERE (p_unit_id IS NULL OR unit_id = p_unit_id)
    AND ploomes_create_date >= DATE_TRUNC('month', CURRENT_DATE) - (p_months || ' months')::INTERVAL
  GROUP BY TO_CHAR(ploomes_create_date, 'YYYY-MM'), pa.prev_total_leads, pa.prev_won_leads, pa.prev_conversion_rate
  ORDER BY month DESC;
END;
$function$;

-- 2) get_bi_funnel_data — bucket ganhos via is_festa_ganha (unidade pretendida intocada)
CREATE OR REPLACE FUNCTION public.get_bi_funnel_data(p_unit_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(stage_id bigint, stage_name text, total bigint, em_aberto bigint, ganhos bigint, perdidos bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.check_permission_or_raise('bi', 'view');

  RETURN QUERY
  SELECT
    pd.stage_id,
    pd.stage_name,
    COUNT(*)::BIGINT AS total,
    COUNT(*) FILTER (WHERE pd.status_id = 1)::BIGINT AS em_aberto,
    COUNT(*) FILTER (WHERE is_festa_ganha(pd.status_id, pd.stage_id))::BIGINT AS ganhos,
    COUNT(*) FILTER (WHERE pd.status_id = 3)::BIGINT AS perdidos
  FROM public.ploomes_deals pd
  WHERE (p_unit_id IS NULL OR pd.unit_id = p_unit_id)
  GROUP BY pd.stage_id, pd.stage_name
  ORDER BY total DESC;
END;
$function$;

-- 3) get_bi_seller_funnel — bucket e valor de ganho via is_festa_ganha
CREATE OR REPLACE FUNCTION public.get_bi_seller_funnel(p_owner_name text, p_unit_id uuid DEFAULT NULL::uuid, p_period_months integer DEFAULT 6)
 RETURNS TABLE(bucket text, deals_count bigint, total_value numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_start_date DATE;
BEGIN
  PERFORM public.check_permission_or_raise('bi_atendimento', 'view');
  v_start_date := CURRENT_DATE - (p_period_months || ' months')::INTERVAL;

  RETURN QUERY
  WITH prods AS (
    SELECT po.deal_id, COALESCE(SUM(pop.total), 0) AS soma_prod
    FROM ploomes_orders po
    LEFT JOIN ploomes_order_products pop ON pop.order_id = po.ploomes_order_id
    GROUP BY po.deal_id
  ),
  classified AS (
    SELECT
      CASE
        WHEN is_festa_ganha(pd.status_id, pd.stage_id) THEN 'ganhos'
        WHEN pd.status_id = 3                           THEN 'perdidos'
        ELSE                                                 'em_aberto'
      END AS bucket,
      CASE
        WHEN is_festa_ganha(pd.status_id, pd.stage_id) THEN COALESCE(pr.soma_prod, 0)
        ELSE COALESCE(pd.deal_amount, 0)
      END AS valor
    FROM public.ploomes_deals pd
    LEFT JOIN prods pr ON pr.deal_id = pd.ploomes_deal_id
    WHERE pd.owner_name = p_owner_name
      AND pd.ploomes_create_date >= v_start_date
      AND (p_unit_id IS NULL OR pd.unit_id = p_unit_id)
      AND pd.status_id IN (1, 2, 3)
  )
  SELECT c.bucket::TEXT, COUNT(*)::BIGINT, COALESCE(SUM(c.valor), 0)::NUMERIC
  FROM classified c
  GROUP BY c.bucket
  ORDER BY CASE c.bucket WHEN 'em_aberto' THEN 1 WHEN 'ganhos' THEN 2 WHEN 'perdidos' THEN 3 END;
END;
$function$;

-- 4) get_vendas_my_kpis — won via is_festa_ganha (sem filtro de unidade; baseado em vendedora)
CREATE OR REPLACE FUNCTION public.get_vendas_my_kpis(p_seller_id uuid, p_start_date date, p_end_date date, p_prev_start date, p_prev_end date)
 RETURNS TABLE(total_revenue numeric, order_count integer, avg_ticket numeric, won_count integer, conversion_rate numeric, prev_revenue numeric, prev_order_count integer, prev_avg_ticket numeric, prev_won_count integer, prev_conversion_rate numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_role   TEXT;
  v_caller_seller UUID;
  v_eff_seller    UUID;
  v_owner_int     INTEGER;
BEGIN
  SELECT u.role, u.seller_id INTO v_caller_role, v_caller_seller
    FROM public.users u WHERE u.id = auth.uid();

  PERFORM public.check_permission_or_raise('vendas', 'view');

  IF v_caller_role = 'vendedora' THEN
    IF v_caller_seller IS NULL THEN RAISE EXCEPTION 'seller_not_linked'; END IF;
    v_eff_seller := v_caller_seller;
  ELSE
    v_eff_seller := p_seller_id;
  END IF;

  IF v_eff_seller IS NOT NULL THEN
    SELECT s.owner_id INTO v_owner_int FROM public.sellers s WHERE s.id = v_eff_seller;
  END IF;

  RETURN QUERY
  WITH
  order_prods AS (
    SELECT po.ploomes_order_id, po.date, po.owner_id, COALESCE(SUM(pop.total), 0) AS soma_prod
    FROM public.ploomes_orders po
    LEFT JOIN public.ploomes_order_products pop ON pop.order_id = po.ploomes_order_id
    WHERE po.date BETWEEN p_prev_start AND p_end_date
      AND (v_eff_seller IS NULL OR po.owner_id = v_owner_int)
    GROUP BY po.ploomes_order_id, po.date, po.owner_id
  ),
  orders_agg AS (
    SELECT
      SUM(CASE WHEN op.date BETWEEN p_start_date AND p_end_date THEN op.soma_prod ELSE 0 END)  AS curr_rev,
      COUNT(CASE WHEN op.date BETWEEN p_start_date AND p_end_date THEN 1 END)                   AS curr_cnt,
      SUM(CASE WHEN op.date BETWEEN p_prev_start AND p_prev_end  THEN op.soma_prod ELSE 0 END) AS prev_rev,
      COUNT(CASE WHEN op.date BETWEEN p_prev_start AND p_prev_end  THEN 1 END)                  AS prev_cnt
    FROM order_prods op
  ),
  deals_agg AS (
    SELECT
      COUNT(CASE WHEN pd.ploomes_create_date::date BETWEEN p_start_date AND p_end_date
                  AND is_festa_ganha(pd.status_id, pd.stage_id) THEN 1 END)  AS curr_won,
      COUNT(CASE WHEN pd.ploomes_create_date::date BETWEEN p_start_date AND p_end_date THEN 1 END) AS curr_total,
      COUNT(CASE WHEN pd.ploomes_create_date::date BETWEEN p_prev_start AND p_prev_end
                  AND is_festa_ganha(pd.status_id, pd.stage_id) THEN 1 END)  AS prev_won,
      COUNT(CASE WHEN pd.ploomes_create_date::date BETWEEN p_prev_start AND p_prev_end THEN 1 END) AS prev_total
    FROM public.ploomes_deals pd
    WHERE pd.ploomes_create_date::date BETWEEN p_prev_start AND p_end_date
      AND (v_eff_seller IS NULL OR pd.owner_id = v_owner_int)
  )
  SELECT
    COALESCE(oa.curr_rev, 0)::NUMERIC,
    COALESCE(oa.curr_cnt, 0)::INTEGER,
    CASE WHEN COALESCE(oa.curr_cnt, 0) > 0 THEN (oa.curr_rev / oa.curr_cnt)::NUMERIC ELSE 0::NUMERIC END,
    COALESCE(da.curr_won, 0)::INTEGER,
    CASE WHEN COALESCE(da.curr_total, 0) > 0 THEN (da.curr_won::NUMERIC / da.curr_total * 100)::NUMERIC ELSE 0::NUMERIC END,
    COALESCE(oa.prev_rev, 0)::NUMERIC,
    COALESCE(oa.prev_cnt, 0)::INTEGER,
    CASE WHEN COALESCE(oa.prev_cnt, 0) > 0 THEN (oa.prev_rev / oa.prev_cnt)::NUMERIC ELSE 0::NUMERIC END,
    COALESCE(da.prev_won, 0)::INTEGER,
    CASE WHEN COALESCE(da.prev_total, 0) > 0 THEN (da.prev_won::NUMERIC / da.prev_total * 100)::NUMERIC ELSE 0::NUMERIC END
  FROM orders_agg oa, deals_agg da;
END;
$function$;

-- ════════════════════════════════════════════════════════════
-- CLUSTER 2 — unidade da festa em grão de Order
-- ════════════════════════════════════════════════════════════

-- 5) get_bi_sales_kpi — filtro de unidade por resolve_festa_unit (order-grain). Sem critério.
CREATE OR REPLACE FUNCTION public.get_bi_sales_kpi(p_start_date date, p_end_date date, p_unit_id uuid DEFAULT NULL::uuid, p_include_inactive boolean DEFAULT false)
 RETURNS TABLE(total_revenue numeric, total_orders bigint, avg_ticket numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.check_permission_or_raise('bi_vendas', 'view');

  RETURN QUERY
  WITH order_prods AS (
    SELECT po.ploomes_order_id, po.owner_id, po.date,
           COALESCE(SUM(pop.total), 0) AS soma_prod
    FROM ploomes_orders po
    LEFT JOIN ploomes_order_products pop ON pop.order_id = po.ploomes_order_id
    LEFT JOIN ploomes_deals pd ON pd.ploomes_deal_id = po.deal_id
    WHERE po.date BETWEEN p_start_date AND p_end_date
      AND (p_unit_id IS NULL OR resolve_festa_unit(po.chosen_unit_id, pd.escolhida_unit_id, pd.unit_id) = p_unit_id)
    GROUP BY po.ploomes_order_id, po.owner_id, po.date
  )
  SELECT
    COALESCE(SUM(op.soma_prod), 0)::NUMERIC                              AS total_revenue,
    COUNT(DISTINCT op.ploomes_order_id)::BIGINT                          AS total_orders,
    CASE WHEN COUNT(DISTINCT op.ploomes_order_id) > 0
         THEN (COALESCE(SUM(op.soma_prod), 0) / COUNT(DISTINCT op.ploomes_order_id))::NUMERIC
         ELSE 0::NUMERIC END                                            AS avg_ticket
  FROM order_prods op
  JOIN sellers s ON s.owner_id = op.owner_id
  WHERE (p_include_inactive OR (s.status = 'active' AND s.is_system_account = FALSE));
END;
$function$;

-- 6) get_bi_sales_ranking — filtro de unidade por resolve_festa_unit (order-grain). Sem critério.
CREATE OR REPLACE FUNCTION public.get_bi_sales_ranking(p_start_date date, p_end_date date, p_unit_id uuid DEFAULT NULL::uuid, p_include_inactive boolean DEFAULT false)
 RETURNS TABLE(seller_id uuid, seller_name text, seller_status text, is_system_account boolean, hire_date date, termination_date date, total_revenue numeric, order_count bigint, avg_ticket numeric, months_worked numeric, avg_monthly_revenue numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.check_permission_or_raise('bi_vendas', 'view');

  RETURN QUERY
  WITH filtered_sellers AS (
    SELECT s.id, s.name, s.status, s.is_system_account, s.hire_date, s.termination_date, s.owner_id,
      GREATEST(COALESCE(s.hire_date, p_start_date), p_start_date) AS eff_start,
      LEAST(COALESCE(s.termination_date, p_end_date), p_end_date) AS eff_end
    FROM sellers s
    WHERE (p_include_inactive OR (s.status = 'active' AND s.is_system_account = FALSE))
      AND COALESCE(s.hire_date, p_start_date) <= p_end_date
  ),
  order_prods AS (
    SELECT po.ploomes_order_id, po.owner_id, COALESCE(SUM(pop.total), 0) AS soma_prod
    FROM ploomes_orders po
    LEFT JOIN ploomes_order_products pop ON pop.order_id = po.ploomes_order_id
    LEFT JOIN ploomes_deals pd ON pd.ploomes_deal_id = po.deal_id
    WHERE po.date BETWEEN p_start_date AND p_end_date
      AND (p_unit_id IS NULL OR resolve_festa_unit(po.chosen_unit_id, pd.escolhida_unit_id, pd.unit_id) = p_unit_id)
    GROUP BY po.ploomes_order_id, po.owner_id
  ),
  aggregated AS (
    SELECT fs.id AS seller_id, fs.name AS seller_name, fs.status, fs.is_system_account,
      fs.hire_date, fs.termination_date, fs.eff_start, fs.eff_end,
      COALESCE(SUM(op.soma_prod), 0)::NUMERIC AS total_revenue,
      COUNT(DISTINCT op.ploomes_order_id)::BIGINT AS order_count
    FROM filtered_sellers fs
    LEFT JOIN order_prods op ON op.owner_id = fs.owner_id
    GROUP BY fs.id, fs.name, fs.status, fs.is_system_account, fs.hire_date, fs.termination_date, fs.eff_start, fs.eff_end
  )
  SELECT
    a.seller_id, a.seller_name, a.status AS seller_status, a.is_system_account, a.hire_date, a.termination_date,
    a.total_revenue, a.order_count,
    CASE WHEN a.order_count > 0 THEN a.total_revenue / a.order_count ELSE 0::NUMERIC END AS avg_ticket,
    GREATEST(1.0, (a.eff_end - a.eff_start)::NUMERIC / 30.4375) AS months_worked,
    CASE WHEN a.total_revenue > 0 THEN a.total_revenue / GREATEST(1.0, (a.eff_end - a.eff_start)::NUMERIC / 30.4375) ELSE 0::NUMERIC END AS avg_monthly_revenue
  FROM aggregated a
  ORDER BY a.total_revenue DESC;
END;
$function$;

-- 7) get_vendas_ranking — receita por resolve_festa_unit (order-grain) + deals_won via is_festa_ganha
CREATE OR REPLACE FUNCTION public.get_vendas_ranking(p_start_date date, p_end_date date, p_unit_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(seller_id uuid, seller_name text, total_revenue numeric, order_count integer, avg_ticket numeric, deals_won integer, conversion_rate numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.check_permission_or_raise('vendas', 'view');

  RETURN QUERY
  WITH
  order_prods AS (
    SELECT po.ploomes_order_id, po.owner_id, COALESCE(SUM(pop.total), 0) AS soma_prod
    FROM public.ploomes_orders po
    LEFT JOIN public.ploomes_order_products pop ON pop.order_id = po.ploomes_order_id
    LEFT JOIN public.ploomes_deals pd ON pd.ploomes_deal_id = po.deal_id
    WHERE po.date BETWEEN p_start_date AND p_end_date
      AND (p_unit_id IS NULL OR resolve_festa_unit(po.chosen_unit_id, pd.escolhida_unit_id, pd.unit_id) = p_unit_id)
    GROUP BY po.ploomes_order_id, po.owner_id
  ),
  ranked_sellers AS (
    SELECT s.id AS seller_id, s.name AS seller_name, s.owner_id AS s_owner_id,
      COALESCE(SUM(op.soma_prod), 0)::NUMERIC AS total_revenue,
      COUNT(DISTINCT op.ploomes_order_id)::INTEGER AS order_count
    FROM public.sellers s
    LEFT JOIN order_prods op ON op.owner_id = s.owner_id
    WHERE s.status = 'active' AND s.is_system_account = FALSE
    GROUP BY s.id, s.name, s.owner_id
  ),
  deals_by_owner AS (
    SELECT pd.owner_id,
      COUNT(CASE WHEN is_festa_ganha(pd.status_id, pd.stage_id) THEN 1 END)::INTEGER AS deals_won,
      COUNT(*)::INTEGER AS deals_total
    FROM public.ploomes_deals pd
    WHERE pd.ploomes_create_date::date BETWEEN p_start_date AND p_end_date
    GROUP BY pd.owner_id
  )
  SELECT
    rs.seller_id, rs.seller_name, rs.total_revenue, rs.order_count,
    CASE WHEN rs.order_count > 0 THEN (rs.total_revenue / rs.order_count)::NUMERIC ELSE 0::NUMERIC END AS avg_ticket,
    COALESCE(dbo.deals_won, 0)::INTEGER AS deals_won,
    CASE WHEN COALESCE(dbo.deals_total, 0) > 0 THEN (COALESCE(dbo.deals_won, 0)::NUMERIC / dbo.deals_total * 100)::NUMERIC ELSE 0::NUMERIC END AS conversion_rate
  FROM ranked_sellers rs
  LEFT JOIN deals_by_owner dbo ON dbo.owner_id = rs.s_owner_id
  ORDER BY rs.total_revenue DESC;
END;
$function$;

-- ════════════════════════════════════════════════════════════
-- CLUSTER 3 — receita pela festa (pop.unit_id); contagens/conversão pela pretendida
-- ════════════════════════════════════════════════════════════

-- 8) get_bi_seller_history — contagens/tempo pretendida; receita por pop.unit_id (festa)
CREATE OR REPLACE FUNCTION public.get_bi_seller_history(p_owner_name text, p_unit_id uuid DEFAULT NULL::uuid, p_period_months integer DEFAULT 6)
 RETURNS TABLE(month_label text, leads_count bigint, won_count bigint, revenue numeric, avg_days_to_close numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_start_date DATE;
BEGIN
  PERFORM public.check_permission_or_raise('bi_atendimento', 'view');
  v_start_date := DATE_TRUNC('month', CURRENT_DATE - (p_period_months || ' months')::INTERVAL);

  RETURN QUERY
  WITH
  prods_by_unit AS (
    SELECT po.deal_id, pop.unit_id AS festa_unit, SUM(pop.total) AS val
    FROM ploomes_orders po
    JOIN ploomes_order_products pop ON pop.order_id = po.ploomes_order_id
    GROUP BY po.deal_id, pop.unit_id
  ),
  counts AS (
    SELECT DATE_TRUNC('month', pd.ploomes_create_date) AS mon,
      COUNT(*)::BIGINT AS leads_count,
      COUNT(*) FILTER (WHERE is_festa_ganha(pd.status_id, pd.stage_id))::BIGINT AS won_count,
      ROUND(AVG(EXTRACT(EPOCH FROM (pd.ploomes_last_update - pd.ploomes_create_date)) / 86400.0)
            FILTER (WHERE is_festa_ganha(pd.status_id, pd.stage_id)), 1)::NUMERIC AS avg_days_to_close
    FROM public.ploomes_deals pd
    WHERE pd.owner_name = p_owner_name
      AND pd.ploomes_create_date >= v_start_date
      AND (p_unit_id IS NULL OR pd.unit_id = p_unit_id)
    GROUP BY DATE_TRUNC('month', pd.ploomes_create_date)
  ),
  revenue AS (
    SELECT DATE_TRUNC('month', pd.ploomes_create_date) AS mon,
      COALESCE(SUM(pbu.val), 0) AS revenue
    FROM public.ploomes_deals pd
    JOIN prods_by_unit pbu ON pbu.deal_id = pd.ploomes_deal_id
    WHERE pd.owner_name = p_owner_name
      AND pd.ploomes_create_date >= v_start_date
      AND is_festa_ganha(pd.status_id, pd.stage_id)
      AND (p_unit_id IS NULL OR pbu.festa_unit = p_unit_id)
    GROUP BY DATE_TRUNC('month', pd.ploomes_create_date)
  )
  SELECT
    TO_CHAR(COALESCE(c.mon, r.mon), 'YYYY-MM') AS month_label,
    COALESCE(c.leads_count, 0)::BIGINT AS leads_count,
    COALESCE(c.won_count, 0)::BIGINT AS won_count,
    COALESCE(r.revenue, 0)::NUMERIC AS revenue,
    c.avg_days_to_close
  FROM counts c
  FULL JOIN revenue r ON r.mon = c.mon
  ORDER BY COALESCE(c.mon, r.mon);
END;
$function$;

-- 9) get_bi_sellers_ranking — contagens/conversão pretendida; receita+ticket por pop.unit_id (festa)
CREATE OR REPLACE FUNCTION public.get_bi_sellers_ranking(p_unit_id uuid DEFAULT NULL::uuid, p_period_months integer DEFAULT 6)
 RETURNS TABLE(owner_name text, leads_count bigint, won_count bigint, lost_count bigint, open_count bigint, conversion_rate numeric, avg_ticket numeric, total_revenue numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_start_date DATE;
BEGIN
  PERFORM public.check_permission_or_raise('bi_atendimento', 'view');
  v_start_date := CURRENT_DATE - (p_period_months || ' months')::INTERVAL;

  RETURN QUERY
  WITH
  prods_by_unit AS (
    SELECT po.deal_id, pop.unit_id AS festa_unit, SUM(pop.total) AS val
    FROM ploomes_orders po
    JOIN ploomes_order_products pop ON pop.order_id = po.ploomes_order_id
    GROUP BY po.deal_id, pop.unit_id
  ),
  counts AS (
    SELECT pd.owner_name,
      COUNT(*)::BIGINT AS leads_count,
      COUNT(*) FILTER (WHERE is_festa_ganha(pd.status_id, pd.stage_id))::BIGINT AS won_count,
      COUNT(*) FILTER (WHERE pd.status_id = 3)::BIGINT AS lost_count,
      COUNT(*) FILTER (WHERE pd.status_id = 1 AND pd.stage_id <> 60004787)::BIGINT AS open_count
    FROM public.ploomes_deals pd
    WHERE pd.owner_name IS NOT NULL
      AND pd.ploomes_create_date >= v_start_date
      AND (p_unit_id IS NULL OR pd.unit_id = p_unit_id)
    GROUP BY pd.owner_name
  ),
  revenue AS (
    SELECT pd.owner_name,
      COALESCE(SUM(pbu.val), 0) AS total_revenue,
      COUNT(DISTINCT pd.ploomes_deal_id) AS won_deals_with_rev
    FROM public.ploomes_deals pd
    JOIN prods_by_unit pbu ON pbu.deal_id = pd.ploomes_deal_id
    WHERE pd.owner_name IS NOT NULL
      AND pd.ploomes_create_date >= v_start_date
      AND is_festa_ganha(pd.status_id, pd.stage_id)
      AND pbu.val > 0
      AND (p_unit_id IS NULL OR pbu.festa_unit = p_unit_id)
    GROUP BY pd.owner_name
  )
  SELECT
    COALESCE(c.owner_name, r.owner_name) AS owner_name,
    COALESCE(c.leads_count, 0)::BIGINT AS leads_count,
    COALESCE(c.won_count, 0)::BIGINT AS won_count,
    COALESCE(c.lost_count, 0)::BIGINT AS lost_count,
    COALESCE(c.open_count, 0)::BIGINT AS open_count,
    CASE WHEN COALESCE(c.leads_count, 0) = 0 THEN 0
         ELSE ROUND(COALESCE(c.won_count, 0)::NUMERIC / c.leads_count::NUMERIC * 100, 1) END AS conversion_rate,
    CASE WHEN COALESCE(r.won_deals_with_rev, 0) = 0 THEN 0
         ELSE (COALESCE(r.total_revenue, 0) / r.won_deals_with_rev)::NUMERIC END AS avg_ticket,
    COALESCE(r.total_revenue, 0)::NUMERIC AS total_revenue
  FROM counts c
  FULL JOIN revenue r ON r.owner_name = c.owner_name
  ORDER BY total_revenue DESC;
END;
$function$;

-- ════════════════════════════════════════════════════════════
-- CLUSTER 4 — base mista completa
-- ════════════════════════════════════════════════════════════

-- 10) get_bi_sales_metrics — won/tempos por events.unit_id (festa 1-por-deal); valor por pop.unit_id
CREATE OR REPLACE FUNCTION public.get_bi_sales_metrics(p_unit_id uuid DEFAULT NULL::uuid, p_months integer DEFAULT 7, p_prev_start date DEFAULT NULL::date, p_prev_end date DEFAULT NULL::date)
 RETURNS TABLE(month text, won_deals bigint, total_revenue numeric, avg_ticket numeric, avg_closing_days numeric, avg_booking_advance_days numeric, prev_revenue numeric, prev_won_deals bigint, prev_avg_ticket numeric, prev_avg_closing_days numeric, prev_avg_advance_days numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.check_permission_or_raise('bi', 'view');

  RETURN QUERY
  WITH
  prods_by_unit AS (
    SELECT po.deal_id, pop.unit_id AS festa_unit, SUM(pop.total) AS val
    FROM ploomes_orders po
    JOIN ploomes_order_products pop ON pop.order_id = po.ploomes_order_id
    GROUP BY po.deal_id, pop.unit_id
  ),
  -- won/tempos do PERÍODO por events.unit_id (festa 1-por-deal)
  won_monthly AS (
    SELECT TO_CHAR(pd.ploomes_create_date, 'YYYY-MM') AS month,
      COUNT(*) FILTER (WHERE is_festa_ganha(pd.status_id, pd.stage_id))::BIGINT AS won_deals,
      ROUND(AVG(EXTRACT(EPOCH FROM (pd.ploomes_last_update - pd.ploomes_create_date)) / 86400.0)
            FILTER (WHERE is_festa_ganha(pd.status_id, pd.stage_id) AND pd.ploomes_last_update > pd.ploomes_create_date), 1)::NUMERIC(6,1) AS avg_closing_days,
      ROUND(AVG((pd.event_date - pd.ploomes_create_date::date)::INTEGER)
            FILTER (WHERE is_festa_ganha(pd.status_id, pd.stage_id) AND pd.event_date IS NOT NULL AND pd.event_date > pd.ploomes_create_date::date), 1)::NUMERIC(6,1) AS avg_booking_advance_days
    FROM ploomes_deals pd
    LEFT JOIN events e ON e.ploomes_deal_id = pd.ploomes_deal_id::text
    WHERE (p_unit_id IS NULL OR COALESCE(e.unit_id, pd.unit_id) = p_unit_id)
      AND pd.ploomes_create_date >= DATE_TRUNC('month', CURRENT_DATE) - (p_months || ' months')::INTERVAL
    GROUP BY TO_CHAR(pd.ploomes_create_date, 'YYYY-MM')
  ),
  -- receita do PERÍODO por pop.unit_id (festa por-produto)
  rev_monthly AS (
    SELECT TO_CHAR(pd.ploomes_create_date, 'YYYY-MM') AS month,
      SUM(pbu.val)::NUMERIC(14,2) AS total_revenue,
      COUNT(DISTINCT pd.ploomes_deal_id) AS won_deals_rev
    FROM ploomes_deals pd
    JOIN prods_by_unit pbu ON pbu.deal_id = pd.ploomes_deal_id
    WHERE is_festa_ganha(pd.status_id, pd.stage_id) AND pbu.val > 0
      AND (p_unit_id IS NULL OR pbu.festa_unit = p_unit_id)
      AND pd.ploomes_create_date >= DATE_TRUNC('month', CURRENT_DATE) - (p_months || ' months')::INTERVAL
    GROUP BY TO_CHAR(pd.ploomes_create_date, 'YYYY-MM')
  ),
  -- período ANTERIOR (won/tempos por events; receita por pop)
  prev_won AS (
    SELECT
      COUNT(*) FILTER (WHERE is_festa_ganha(pd.status_id, pd.stage_id))::BIGINT AS prev_won_deals,
      ROUND(AVG(EXTRACT(EPOCH FROM (pd.ploomes_last_update - pd.ploomes_create_date)) / 86400.0)
            FILTER (WHERE is_festa_ganha(pd.status_id, pd.stage_id) AND pd.ploomes_last_update > pd.ploomes_create_date), 1)::NUMERIC(6,1) AS prev_avg_closing_days,
      ROUND(AVG((pd.event_date - pd.ploomes_create_date::date)::INTEGER)
            FILTER (WHERE is_festa_ganha(pd.status_id, pd.stage_id) AND pd.event_date IS NOT NULL AND pd.event_date > pd.ploomes_create_date::date), 1)::NUMERIC(6,1) AS prev_avg_advance_days
    FROM ploomes_deals pd
    LEFT JOIN events e ON e.ploomes_deal_id = pd.ploomes_deal_id::text
    WHERE p_prev_start IS NOT NULL AND p_prev_end IS NOT NULL
      AND (p_unit_id IS NULL OR COALESCE(e.unit_id, pd.unit_id) = p_unit_id)
      AND pd.ploomes_create_date::date BETWEEN p_prev_start AND p_prev_end
  ),
  prev_rev AS (
    SELECT
      SUM(pbu.val)::NUMERIC(14,2) AS prev_revenue,
      COUNT(DISTINCT pd.ploomes_deal_id) AS prev_won_rev
    FROM ploomes_deals pd
    JOIN prods_by_unit pbu ON pbu.deal_id = pd.ploomes_deal_id
    WHERE p_prev_start IS NOT NULL AND p_prev_end IS NOT NULL
      AND is_festa_ganha(pd.status_id, pd.stage_id) AND pbu.val > 0
      AND (p_unit_id IS NULL OR pbu.festa_unit = p_unit_id)
      AND pd.ploomes_create_date::date BETWEEN p_prev_start AND p_prev_end
  )
  SELECT
    COALESCE(wm.month, rm.month) AS month,
    COALESCE(wm.won_deals, 0)::BIGINT AS won_deals,
    CASE WHEN can_view_festa_values() THEN COALESCE(rm.total_revenue, 0)::NUMERIC(14,2) ELSE NULL END AS total_revenue,
    CASE WHEN can_view_festa_values()
         THEN (CASE WHEN COALESCE(rm.won_deals_rev, 0) = 0 THEN NULL ELSE ROUND(rm.total_revenue / rm.won_deals_rev, 2) END)::NUMERIC(12,2)
         ELSE NULL END AS avg_ticket,
    wm.avg_closing_days,
    wm.avg_booking_advance_days,
    CASE WHEN can_view_festa_values() THEN pr.prev_revenue ELSE NULL END AS prev_revenue,
    pw.prev_won_deals,
    CASE WHEN can_view_festa_values()
         THEN (CASE WHEN COALESCE(pr.prev_won_rev, 0) = 0 THEN NULL ELSE ROUND(pr.prev_revenue / pr.prev_won_rev, 2) END)::NUMERIC(12,2)
         ELSE NULL END AS prev_avg_ticket,
    pw.prev_avg_closing_days,
    pw.prev_avg_advance_days
  FROM won_monthly wm
  FULL JOIN rev_monthly rm ON wm.month = rm.month
  LEFT JOIN prev_won pw ON true
  LEFT JOIN prev_rev pr ON true
  ORDER BY month DESC;
END;
$function$;

-- 11) get_bi_unit_comparison — BASE MISTA: leads/conv=pretendida; won/tempos=events; receita=pop
CREATE OR REPLACE FUNCTION public.get_bi_unit_comparison(p_months integer DEFAULT 7)
 RETURNS TABLE(unit_id uuid, unit_name text, total_leads bigint, won_leads bigint, conversion_rate numeric, total_revenue numeric, avg_ticket numeric, avg_closing_days numeric, avg_booking_advance numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.check_permission_or_raise('bi', 'view');

  RETURN QUERY
  WITH
  prods_by_unit AS (
    SELECT po.deal_id, pop.unit_id AS festa_unit, SUM(pop.total) AS val
    FROM ploomes_orders po
    JOIN ploomes_order_products pop ON pop.order_id = po.ploomes_order_id
    GROUP BY po.deal_id, pop.unit_id
  ),
  -- leads + numerador da conversão pela PRETENDIDA (pd.unit_id)
  leads_base AS (
    SELECT pd.unit_id AS unit,
      COUNT(*)::BIGINT AS total_leads,
      COUNT(*) FILTER (WHERE is_festa_ganha(pd.status_id, pd.stage_id))::BIGINT AS won_for_conv
    FROM ploomes_deals pd
    WHERE pd.ploomes_create_date >= DATE_TRUNC('month', CURRENT_DATE) - (p_months || ' months')::INTERVAL
    GROUP BY pd.unit_id
  ),
  -- won + tempos pela FESTA 1-por-deal (events.unit_id, guarda COALESCE pretendida)
  won_base AS (
    SELECT COALESCE(e.unit_id, pd.unit_id) AS unit,
      COUNT(*) FILTER (WHERE is_festa_ganha(pd.status_id, pd.stage_id))::BIGINT AS won_leads,
      ROUND(AVG(EXTRACT(EPOCH FROM (pd.ploomes_last_update - pd.ploomes_create_date)) / 86400.0)
            FILTER (WHERE is_festa_ganha(pd.status_id, pd.stage_id) AND pd.ploomes_last_update > pd.ploomes_create_date), 1)::NUMERIC(6,1) AS avg_closing_days,
      ROUND(AVG((pd.event_date - pd.ploomes_create_date::date)::INTEGER)
            FILTER (WHERE is_festa_ganha(pd.status_id, pd.stage_id) AND pd.event_date IS NOT NULL AND pd.event_date > pd.ploomes_create_date::date), 1)::NUMERIC(6,1) AS avg_booking_advance
    FROM ploomes_deals pd
    LEFT JOIN events e ON e.ploomes_deal_id = pd.ploomes_deal_id::text
    WHERE pd.ploomes_create_date >= DATE_TRUNC('month', CURRENT_DATE) - (p_months || ' months')::INTERVAL
    GROUP BY COALESCE(e.unit_id, pd.unit_id)
  ),
  -- receita pela FESTA por-produto (pop.unit_id)
  rev_base AS (
    SELECT pbu.festa_unit AS unit,
      SUM(pbu.val)::NUMERIC(14,2) AS total_revenue,
      COUNT(DISTINCT pd.ploomes_deal_id) AS won_deals_with_rev
    FROM ploomes_deals pd
    JOIN prods_by_unit pbu ON pbu.deal_id = pd.ploomes_deal_id
    WHERE is_festa_ganha(pd.status_id, pd.stage_id) AND pbu.val > 0
      AND pd.ploomes_create_date >= DATE_TRUNC('month', CURRENT_DATE) - (p_months || ' months')::INTERVAL
    GROUP BY pbu.festa_unit
  ),
  all_units AS (
    SELECT unit FROM leads_base WHERE unit IS NOT NULL
    UNION SELECT unit FROM won_base WHERE unit IS NOT NULL
    UNION SELECT unit FROM rev_base WHERE unit IS NOT NULL
  )
  SELECT
    u.unit AS unit_id,
    un.name AS unit_name,
    COALESCE(l.total_leads, 0)::BIGINT AS total_leads,
    COALESCE(w.won_leads, 0)::BIGINT AS won_leads,
    CASE WHEN COALESCE(l.total_leads, 0) = 0 THEN NULL
         ELSE ROUND(COALESCE(l.won_for_conv, 0)::NUMERIC / l.total_leads::NUMERIC * 100, 2) END AS conversion_rate,
    CASE WHEN can_view_festa_values() THEN COALESCE(r.total_revenue, 0)::NUMERIC(14,2) ELSE NULL END AS total_revenue,
    CASE WHEN can_view_festa_values()
         THEN (CASE WHEN COALESCE(r.won_deals_with_rev, 0) = 0 THEN NULL ELSE ROUND(r.total_revenue / r.won_deals_with_rev, 2) END)::NUMERIC(12,2)
         ELSE NULL END AS avg_ticket,
    w.avg_closing_days,
    w.avg_booking_advance
  FROM all_units u
  JOIN units un ON un.id = u.unit
  LEFT JOIN leads_base l ON l.unit = u.unit
  LEFT JOIN won_base w ON w.unit = u.unit
  LEFT JOIN rev_base r ON r.unit = u.unit
  ORDER BY total_leads DESC;
END;
$function$;

NOTIFY pgrst, 'reload schema';

COMMIT;
