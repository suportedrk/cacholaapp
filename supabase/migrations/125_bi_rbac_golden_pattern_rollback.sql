-- ============================================================
-- Rollback da Migration 125 — BI: reverte a conversão dos guards
--
-- Restaura o estado pré-Parte 2:
--   1c'. Recria os 17 RPCs get_bi_* com guard por CARGO (role IN) —
--        corpos = dump pré-conversão do banco vivo (produção), idênticos
--        ao que a 125 substituiu. can_view_festa_values() preservado.
--   1b'. Re-adiciona gerente e financeiro ao template bi_vendas.
--   1a'. Re-insere os grants individuais removidos do gerente
--        brunocasaletti@gmail.com (5 ações × 3 módulos BI).
--
-- ⚠ LIMITAÇÕES:
--   - 1a': re-insere SOMENTE o override conhecido do gerente
--     brunocasaletti@gmail.com (auditoria 2026-05-29). Se a 125 tiver
--     removido grants de OUTROS usuários criados entre-tempo, este rollback
--     NÃO os restaura. Recomenda-se snapshot antes de rodar a 125 em prod.
--   - 1b': o INSERT no template assume que as linhas (gerente/financeiro ×
--     bi_vendas × 5 ações) existiam antes; re-cria as 10 linhas com
--     granted=true (estado pré-125 auditado).
--   - O guard restaurado é BROAD (sa,dir,ger,fin) para os 14 RPCs que eram
--     BROAD e NARROW (sa,dir) para os 3 de drill-down — exatamente como
--     estavam antes da 125.
--
-- Transação única. Idempotente.
-- ============================================================

BEGIN;

-- Restaura os 17 RPCs aos guards por cargo (dump pré-conversão do banco vivo)

-- ── get_bi_conversion_data (guard por cargo restaurado) ──
CREATE OR REPLACE FUNCTION public.get_bi_conversion_data(p_unit_id uuid DEFAULT NULL::uuid, p_months integer DEFAULT 7, p_prev_start date DEFAULT NULL::date, p_prev_end date DEFAULT NULL::date)
 RETURNS TABLE(month text, total_leads bigint, won_leads bigint, conversion_rate numeric, prev_total_leads bigint, prev_won_leads bigint, prev_conversion_rate numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'diretor', 'gerente', 'financeiro')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  RETURN QUERY
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
END;
$function$

;

-- ── get_bi_funnel_data (guard por cargo restaurado) ──
CREATE OR REPLACE FUNCTION public.get_bi_funnel_data(p_unit_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(stage_id bigint, stage_name text, total bigint, em_aberto bigint, ganhos bigint, perdidos bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    pd.stage_id,
    pd.stage_name,
    COUNT(*)::BIGINT                                                                          AS total,
    COUNT(*) FILTER (WHERE pd.status_id = 1)::BIGINT                                         AS em_aberto,
    COUNT(*) FILTER (WHERE pd.status_id = 2 OR pd.stage_id = 60004787)::BIGINT               AS ganhos,
    COUNT(*) FILTER (WHERE pd.status_id = 3)::BIGINT                                         AS perdidos
  FROM public.ploomes_deals pd
  WHERE (p_unit_id IS NULL OR pd.unit_id = p_unit_id)
  GROUP BY pd.stage_id, pd.stage_name
  ORDER BY total DESC;
END;
$function$

;

-- ── get_bi_lead_origin_breakdown (guard por cargo restaurado) ──
CREATE OR REPLACE FUNCTION public.get_bi_lead_origin_breakdown(p_unit_id uuid, p_period_months integer DEFAULT 6)
 RETURNS TABLE(month_start date, category text, total bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END;
$function$

;

-- ── get_bi_sales_metrics (guard por cargo restaurado) ──
CREATE OR REPLACE FUNCTION public.get_bi_sales_metrics(p_unit_id uuid DEFAULT NULL::uuid, p_months integer DEFAULT 7, p_prev_start date DEFAULT NULL::date, p_prev_end date DEFAULT NULL::date)
 RETURNS TABLE(month text, won_deals bigint, total_revenue numeric, avg_ticket numeric, avg_closing_days numeric, avg_booking_advance_days numeric, prev_revenue numeric, prev_won_deals bigint, prev_avg_ticket numeric, prev_avg_closing_days numeric, prev_avg_advance_days numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'diretor', 'gerente', 'financeiro')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  RETURN QUERY
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
END;
$function$

;

-- ── get_bi_unit_comparison (guard por cargo restaurado) ──
CREATE OR REPLACE FUNCTION public.get_bi_unit_comparison(p_months integer DEFAULT 7)
 RETURNS TABLE(unit_id uuid, unit_name text, total_leads bigint, won_leads bigint, conversion_rate numeric, total_revenue numeric, avg_ticket numeric, avg_closing_days numeric, avg_booking_advance numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'diretor', 'gerente', 'financeiro')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  RETURN QUERY
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
END;
$function$

;

-- ── get_bi_sellers_ranking (guard por cargo restaurado) ──
CREATE OR REPLACE FUNCTION public.get_bi_sellers_ranking(p_unit_id uuid DEFAULT NULL::uuid, p_period_months integer DEFAULT 6)
 RETURNS TABLE(owner_name text, leads_count bigint, won_count bigint, lost_count bigint, open_count bigint, conversion_rate numeric, avg_ticket numeric, total_revenue numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  WITH prods AS (
    SELECT
      po.deal_id,
      COALESCE(SUM(pop.total), 0) AS soma_prod
    FROM ploomes_orders po
    LEFT JOIN ploomes_order_products pop ON pop.order_id = po.ploomes_order_id
    GROUP BY po.deal_id
  )
  SELECT
    pd.owner_name,
    COUNT(*)::BIGINT                                                                    AS leads_count,
    COUNT(*) FILTER (WHERE pd.status_id = 2 OR pd.stage_id = 60004787)::BIGINT        AS won_count,
    COUNT(*) FILTER (WHERE pd.status_id = 3)::BIGINT                                   AS lost_count,
    COUNT(*) FILTER (WHERE pd.status_id = 1 AND pd.stage_id <> 60004787)::BIGINT       AS open_count,
    CASE
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND(
        COUNT(*) FILTER (WHERE pd.status_id = 2 OR pd.stage_id = 60004787)::NUMERIC
        / COUNT(*)::NUMERIC * 100, 1
      )
    END                                                                                 AS conversion_rate,
    COALESCE(
      AVG(pr.soma_prod) FILTER (WHERE pd.status_id = 2 OR pd.stage_id = 60004787), 0
    )::NUMERIC                                                                          AS avg_ticket,
    COALESCE(
      SUM(pr.soma_prod) FILTER (WHERE pd.status_id = 2 OR pd.stage_id = 60004787), 0
    )::NUMERIC                                                                          AS total_revenue
  FROM public.ploomes_deals pd
  LEFT JOIN prods pr ON pr.deal_id = pd.ploomes_deal_id
  WHERE pd.owner_name IS NOT NULL
    AND pd.ploomes_create_date >= v_start_date
    AND (p_unit_id IS NULL OR pd.unit_id = p_unit_id)
  GROUP BY pd.owner_name
  ORDER BY total_revenue DESC;
END;
$function$

;

-- ── get_bi_seller_history (guard por cargo restaurado) ──
CREATE OR REPLACE FUNCTION public.get_bi_seller_history(p_owner_name text, p_unit_id uuid DEFAULT NULL::uuid, p_period_months integer DEFAULT 6)
 RETURNS TABLE(month_label text, leads_count bigint, won_count bigint, revenue numeric, avg_days_to_close numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  WITH prods AS (
    SELECT
      po.deal_id,
      COALESCE(SUM(pop.total), 0) AS soma_prod
    FROM ploomes_orders po
    LEFT JOIN ploomes_order_products pop ON pop.order_id = po.ploomes_order_id
    GROUP BY po.deal_id
  )
  SELECT
    TO_CHAR(DATE_TRUNC('month', pd.ploomes_create_date), 'YYYY-MM')    AS month_label,
    COUNT(*)::BIGINT                                                    AS leads_count,
    COUNT(*) FILTER (
      WHERE pd.status_id = 2 OR pd.stage_id = 60004787
    )::BIGINT                                                           AS won_count,
    COALESCE(
      SUM(pr.soma_prod) FILTER (WHERE pd.status_id = 2 OR pd.stage_id = 60004787), 0
    )::NUMERIC                                                          AS revenue,
    ROUND(
      AVG(
        EXTRACT(EPOCH FROM (pd.ploomes_last_update - pd.ploomes_create_date)) / 86400.0
      ) FILTER (WHERE pd.status_id = 2 OR pd.stage_id = 60004787),
      1
    )::NUMERIC                                                          AS avg_days_to_close
  FROM public.ploomes_deals pd
  LEFT JOIN prods pr ON pr.deal_id = pd.ploomes_deal_id
  WHERE pd.owner_name = p_owner_name
    AND pd.ploomes_create_date >= v_start_date
    AND (p_unit_id IS NULL OR pd.unit_id = p_unit_id)
  GROUP BY DATE_TRUNC('month', pd.ploomes_create_date)
  ORDER BY DATE_TRUNC('month', pd.ploomes_create_date);
END;
$function$

;

-- ── get_bi_seller_funnel (guard por cargo restaurado) ──
CREATE OR REPLACE FUNCTION public.get_bi_seller_funnel(p_owner_name text, p_unit_id uuid DEFAULT NULL::uuid, p_period_months integer DEFAULT 6)
 RETURNS TABLE(bucket text, deals_count bigint, total_value numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  WITH prods AS (
    SELECT
      po.deal_id,
      COALESCE(SUM(pop.total), 0) AS soma_prod
    FROM ploomes_orders po
    LEFT JOIN ploomes_order_products pop ON pop.order_id = po.ploomes_order_id
    GROUP BY po.deal_id
  ),
  classified AS (
    SELECT
      CASE
        WHEN pd.status_id = 2 OR pd.stage_id = 60004787 THEN 'ganhos'
        WHEN pd.status_id = 3                            THEN 'perdidos'
        ELSE                                                  'em_aberto'
      END                                          AS bucket,
      CASE
        WHEN pd.status_id = 2 OR pd.stage_id = 60004787
          THEN COALESCE(pr.soma_prod, 0)
        ELSE COALESCE(pd.deal_amount, 0)
      END                                          AS valor
    FROM public.ploomes_deals pd
    LEFT JOIN prods pr ON pr.deal_id = pd.ploomes_deal_id
    WHERE pd.owner_name = p_owner_name
      AND pd.ploomes_create_date >= v_start_date
      AND (p_unit_id IS NULL OR pd.unit_id = p_unit_id)
      AND pd.status_id IN (1, 2, 3)
  )
  SELECT
    c.bucket::TEXT                    AS bucket,
    COUNT(*)::BIGINT                  AS deals_count,
    COALESCE(SUM(c.valor), 0)::NUMERIC AS total_value
  FROM classified c
  GROUP BY c.bucket
  ORDER BY
    CASE c.bucket
      WHEN 'em_aberto' THEN 1
      WHEN 'ganhos'    THEN 2
      WHEN 'perdidos'  THEN 3
    END;
END;
$function$

;

-- ── get_bi_sales_kpi (guard por cargo restaurado) ──
CREATE OR REPLACE FUNCTION public.get_bi_sales_kpi(p_start_date date, p_end_date date, p_unit_id uuid DEFAULT NULL::uuid, p_include_inactive boolean DEFAULT false)
 RETURNS TABLE(total_revenue numeric, total_orders bigint, avg_ticket numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'diretor', 'gerente', 'financeiro')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  RETURN QUERY
  WITH order_prods AS (
    SELECT
      po.ploomes_order_id,
      po.owner_id,
      po.date,
      po.unit_id,
      COALESCE(SUM(pop.total), 0) AS soma_prod
    FROM ploomes_orders po
    LEFT JOIN ploomes_order_products pop ON pop.order_id = po.ploomes_order_id
    WHERE po.date BETWEEN p_start_date AND p_end_date
      AND (p_unit_id IS NULL OR po.unit_id = p_unit_id)
    GROUP BY po.ploomes_order_id, po.owner_id, po.date, po.unit_id
  )
  SELECT
    COALESCE(SUM(op.soma_prod), 0)::NUMERIC                              AS total_revenue,
    COUNT(DISTINCT op.ploomes_order_id)::BIGINT                          AS total_orders,
    CASE WHEN COUNT(DISTINCT op.ploomes_order_id) > 0
         THEN (COALESCE(SUM(op.soma_prod), 0) / COUNT(DISTINCT op.ploomes_order_id))::NUMERIC
         ELSE 0::NUMERIC
    END                                                                  AS avg_ticket
  FROM order_prods op
  JOIN sellers s ON s.owner_id = op.owner_id
  WHERE (p_include_inactive OR (s.status = 'active' AND s.is_system_account = FALSE));
END;
$function$

;

-- ── get_bi_sales_ranking (guard por cargo restaurado) ──
CREATE OR REPLACE FUNCTION public.get_bi_sales_ranking(p_start_date date, p_end_date date, p_unit_id uuid DEFAULT NULL::uuid, p_include_inactive boolean DEFAULT false)
 RETURNS TABLE(seller_id uuid, seller_name text, seller_status text, is_system_account boolean, hire_date date, termination_date date, total_revenue numeric, order_count bigint, avg_ticket numeric, months_worked numeric, avg_monthly_revenue numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  order_prods AS (
    SELECT
      po.ploomes_order_id,
      po.owner_id,
      COALESCE(SUM(pop.total), 0) AS soma_prod
    FROM ploomes_orders po
    LEFT JOIN ploomes_order_products pop ON pop.order_id = po.ploomes_order_id
    WHERE po.date BETWEEN p_start_date AND p_end_date
      AND (p_unit_id IS NULL OR po.unit_id = p_unit_id)
    GROUP BY po.ploomes_order_id, po.owner_id
  ),
  aggregated AS (
    SELECT
      fs.id                                                              AS seller_id,
      fs.name                                                            AS seller_name,
      fs.status,
      fs.is_system_account,
      fs.hire_date,
      fs.termination_date,
      fs.eff_start,
      fs.eff_end,
      COALESCE(SUM(op.soma_prod), 0)::NUMERIC                           AS total_revenue,
      COUNT(DISTINCT op.ploomes_order_id)::BIGINT                       AS order_count
    FROM filtered_sellers fs
    LEFT JOIN order_prods op ON op.owner_id = fs.owner_id
    GROUP BY
      fs.id, fs.name, fs.status, fs.is_system_account,
      fs.hire_date, fs.termination_date, fs.eff_start, fs.eff_end
  )
  SELECT
    a.seller_id,
    a.seller_name,
    a.status                                                             AS seller_status,
    a.is_system_account,
    a.hire_date,
    a.termination_date,
    a.total_revenue,
    a.order_count,
    CASE WHEN a.order_count > 0
         THEN a.total_revenue / a.order_count
         ELSE 0::NUMERIC
    END                                                                  AS avg_ticket,
    GREATEST(1.0, (a.eff_end - a.eff_start)::NUMERIC / 30.4375)        AS months_worked,
    CASE WHEN a.total_revenue > 0
         THEN a.total_revenue / GREATEST(1.0, (a.eff_end - a.eff_start)::NUMERIC / 30.4375)
         ELSE 0::NUMERIC
    END                                                                  AS avg_monthly_revenue
  FROM aggregated a
  ORDER BY a.total_revenue DESC;
END;
$function$

;

-- ── get_bi_seller_orders (guard por cargo restaurado) ──
CREATE OR REPLACE FUNCTION public.get_bi_seller_orders(p_seller_id uuid, p_start_date date, p_end_date date, p_unit_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(ploomes_order_id bigint, order_date date, amount numeric, deal_id bigint, client_name text, unit_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'diretor', 'gerente', 'financeiro')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  RETURN QUERY
  WITH order_prods AS (
    SELECT
      po2.ploomes_order_id,
      COALESCE(SUM(pop.total), 0) AS soma_prod
    FROM ploomes_orders po2
    LEFT JOIN ploomes_order_products pop ON pop.order_id = po2.ploomes_order_id
    GROUP BY po2.ploomes_order_id
  )
  SELECT
    po.ploomes_order_id,
    po.date                                              AS order_date,
    COALESCE(ops.soma_prod, 0)::NUMERIC                  AS amount,
    po.deal_id,
    COALESCE(po.contact_name, '—')::TEXT                AS client_name,
    COALESCE(u.name, '—')::TEXT                         AS unit_name
  FROM sellers s
  JOIN ploomes_orders po ON po.owner_id = s.owner_id
  LEFT JOIN order_prods ops ON ops.ploomes_order_id = po.ploomes_order_id
  LEFT JOIN units u ON u.id = po.unit_id
  WHERE s.id = p_seller_id
    AND po.date BETWEEN p_start_date AND p_end_date
    AND (p_unit_id IS NULL OR po.unit_id = p_unit_id)
  ORDER BY po.date DESC;
END;
$function$

;

-- ── get_bi_category_kpi (guard por cargo restaurado) ──
CREATE OR REPLACE FUNCTION public.get_bi_category_kpi(p_start_date date, p_end_date date, p_unit_id uuid DEFAULT NULL::uuid, p_include_inactive boolean DEFAULT false)
 RETURNS TABLE(total_categories bigint, top_category_name text, top_category_revenue numeric, total_items bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'diretor', 'gerente', 'financeiro')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      normalize_product_category(pop.group_name) AS category,
      pop.total
    FROM ploomes_order_products pop
    JOIN sellers s ON s.owner_id = pop.owner_id
    WHERE pop.order_date BETWEEN p_start_date AND p_end_date
      AND (p_unit_id IS NULL OR pop.unit_id = p_unit_id)
      AND (p_include_inactive OR (s.status = 'active' AND s.is_system_account = FALSE))
  ),
  by_cat AS (
    SELECT category, SUM(total) AS revenue
    FROM base
    GROUP BY category
  ),
  top_cat AS (
    SELECT category, revenue
    FROM by_cat
    ORDER BY revenue DESC
    LIMIT 1
  )
  SELECT
    (SELECT COUNT(*) FROM by_cat)::BIGINT  AS total_categories,
    (SELECT category FROM top_cat)         AS top_category_name,
    (SELECT revenue  FROM top_cat)         AS top_category_revenue,
    (SELECT COUNT(*) FROM base)::BIGINT    AS total_items;
END;
$function$

;

-- ── get_bi_category_ranking (guard por cargo restaurado) ──
CREATE OR REPLACE FUNCTION public.get_bi_category_ranking(p_start_date date, p_end_date date, p_unit_id uuid DEFAULT NULL::uuid, p_include_inactive boolean DEFAULT false, p_group_by_unit boolean DEFAULT false)
 RETURNS TABLE(category text, unit_family text, revenue numeric, product_count bigint, avg_product_ticket numeric, pct_of_total numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'diretor', 'gerente', 'financeiro')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      normalize_product_category(pop.group_name)                         AS cat,
      CASE WHEN p_group_by_unit THEN pop.family_name ELSE NULL END       AS fam,
      pop.total
    FROM ploomes_order_products pop
    JOIN sellers s ON s.owner_id = pop.owner_id
    WHERE pop.order_date BETWEEN p_start_date AND p_end_date
      AND (p_unit_id IS NULL OR pop.unit_id = p_unit_id)
      AND (p_include_inactive OR (s.status = 'active' AND s.is_system_account = FALSE))
  )
  SELECT
    cat                                                                   AS category,
    fam                                                                   AS unit_family,
    COALESCE(SUM(total), 0)::NUMERIC                                      AS revenue,
    COUNT(*)::BIGINT                                                       AS product_count,
    CASE WHEN COUNT(*) > 0
         THEN (SUM(total) / COUNT(*))::NUMERIC
         ELSE 0::NUMERIC
    END                                                                   AS avg_product_ticket,
    ROUND(
      (SUM(total) / NULLIF(SUM(SUM(total)) OVER (), 0) * 100)::NUMERIC,
    1)                                                                    AS pct_of_total
  FROM filtered
  GROUP BY cat, fam
  ORDER BY revenue DESC;
END;
$function$

;

-- ── get_bi_category_drilldown (guard por cargo restaurado) ──
CREATE OR REPLACE FUNCTION public.get_bi_category_drilldown(p_category text, p_start_date date, p_end_date date, p_unit_id uuid DEFAULT NULL::uuid, p_include_inactive boolean DEFAULT false)
 RETURNS TABLE(kind text, item_name text, item_revenue numeric, item_count bigint, item_avg numeric, rank_position integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'diretor', 'gerente', 'financeiro')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      pop.product_name,
      pop.owner_name,
      pop.total
    FROM ploomes_order_products pop
    JOIN sellers s ON s.owner_id = pop.owner_id
    WHERE normalize_product_category(pop.group_name) = p_category
      AND pop.order_date BETWEEN p_start_date AND p_end_date
      AND (p_unit_id IS NULL OR pop.unit_id = p_unit_id)
      AND (p_include_inactive OR (s.status = 'active' AND s.is_system_account = FALSE))
  ),
  products AS (
    SELECT
      product_name                            AS item_name,
      SUM(total)::NUMERIC                     AS item_revenue,
      COUNT(*)::BIGINT                        AS item_count,
      (SUM(total) / COUNT(*))::NUMERIC        AS item_avg
    FROM filtered
    GROUP BY product_name
  ),
  sellers_agg AS (
    SELECT
      owner_name                              AS item_name,
      SUM(total)::NUMERIC                     AS item_revenue,
      COUNT(*)::BIGINT                        AS item_count,
      (SUM(total) / COUNT(*))::NUMERIC        AS item_avg
    FROM filtered
    WHERE owner_name IS NOT NULL
    GROUP BY owner_name
    ORDER BY item_revenue DESC
    LIMIT 5
  )
  SELECT
    'product'::TEXT                                                   AS kind,
    p.item_name,
    p.item_revenue,
    p.item_count,
    p.item_avg,
    ROW_NUMBER() OVER (ORDER BY p.item_revenue DESC)::INT             AS rank_position
  FROM products p
  UNION ALL
  SELECT
    'seller'::TEXT                                                    AS kind,
    sa.item_name,
    sa.item_revenue,
    sa.item_count,
    sa.item_avg,
    ROW_NUMBER() OVER (ORDER BY sa.item_revenue DESC)::INT            AS rank_position
  FROM sellers_agg sa
  ORDER BY kind ASC, rank_position ASC;  -- 'product' < 'seller'
END;
$function$

;

-- ── get_bi_category_cross_unit (guard por cargo restaurado) ──
CREATE OR REPLACE FUNCTION public.get_bi_category_cross_unit(p_start_date date, p_end_date date, p_include_inactive boolean DEFAULT false)
 RETURNS TABLE(order_unit_name text, product_family text, item_count bigint, revenue numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    u.name::TEXT                             AS order_unit_name,
    pop.family_name::TEXT                    AS product_family,
    COUNT(*)::BIGINT                         AS item_count,
    COALESCE(SUM(pop.total), 0)::NUMERIC     AS revenue
  FROM ploomes_order_products pop
  JOIN sellers s ON s.owner_id = pop.owner_id
  JOIN units u ON u.id = pop.unit_id
  WHERE pop.order_date BETWEEN p_start_date AND p_end_date
    AND pop.family_name IS NOT NULL
    AND NOT (
      (u.name ILIKE '%pinheiros%' AND pop.family_name ILIKE '%pinheiros%')
      OR
      (u.name ILIKE '%moema%'     AND pop.family_name ILIKE '%moema%')
    )
    AND (p_include_inactive OR (s.status = 'active' AND s.is_system_account = FALSE))
  GROUP BY u.name, pop.family_name
  ORDER BY revenue DESC;
END;
$function$

;

-- ── get_bi_adoption_kpi (guard por cargo restaurado) ──
CREATE OR REPLACE FUNCTION public.get_bi_adoption_kpi(p_start_date date, p_end_date date, p_unit_id uuid DEFAULT NULL::uuid, p_include_inactive boolean DEFAULT false)
 RETURNS TABLE(total_orders bigint, orders_preenchidas bigint, percentual_adocao numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    COUNT(po.ploomes_order_id)::BIGINT                                        AS total_orders,
    COUNT(po.ploomes_order_id) FILTER (WHERE po.contracted_guests IS NOT NULL)::BIGINT
                                                                               AS orders_preenchidas,
    CASE
      WHEN COUNT(po.ploomes_order_id) = 0 THEN 0::NUMERIC
      ELSE ROUND(
        COUNT(po.ploomes_order_id) FILTER (WHERE po.contracted_guests IS NOT NULL)::NUMERIC
        / COUNT(po.ploomes_order_id)::NUMERIC * 100,
        1
      )
    END                                                                        AS percentual_adocao
  FROM public.ploomes_orders po
  JOIN public.sellers s ON s.owner_id = po.owner_id
  WHERE po.date BETWEEN p_start_date AND p_end_date
    AND (p_unit_id IS NULL OR po.unit_id = p_unit_id)
    AND (p_include_inactive OR (s.status = 'active' AND s.is_system_account = FALSE));
END;
$function$

;

-- ── get_bi_adoption_ranking (guard por cargo restaurado) ──
CREATE OR REPLACE FUNCTION public.get_bi_adoption_ranking(p_start_date date, p_end_date date, p_unit_id uuid DEFAULT NULL::uuid, p_include_inactive boolean DEFAULT false)
 RETURNS TABLE(seller_id integer, seller_name text, seller_status text, is_system_account boolean, total_orders bigint, orders_preenchidas bigint, percentual_adocao numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    s.owner_id                                                                    AS seller_id,
    s.name                                                                        AS seller_name,
    s.status::TEXT                                                                AS seller_status,
    s.is_system_account                                                           AS is_system_account,
    COUNT(po.ploomes_order_id)::BIGINT                                            AS total_orders,
    COUNT(po.ploomes_order_id) FILTER (WHERE po.contracted_guests IS NOT NULL)::BIGINT
                                                                                  AS orders_preenchidas,
    CASE
      WHEN COUNT(po.ploomes_order_id) = 0 THEN 0::NUMERIC
      ELSE ROUND(
        COUNT(po.ploomes_order_id) FILTER (WHERE po.contracted_guests IS NOT NULL)::NUMERIC
        / COUNT(po.ploomes_order_id)::NUMERIC * 100,
        1
      )
    END                                                                           AS percentual_adocao
  FROM public.sellers s
  JOIN public.ploomes_orders po ON po.owner_id = s.owner_id
  WHERE po.date BETWEEN p_start_date AND p_end_date
    AND (p_unit_id IS NULL OR po.unit_id = p_unit_id)
    AND (p_include_inactive OR (s.status = 'active' AND s.is_system_account = FALSE))
  GROUP BY s.owner_id, s.name, s.status, s.is_system_account
  ORDER BY percentual_adocao DESC, total_orders DESC;
END;
$function$

;

-- ------------------------------------------------------------
-- 1b' — Re-adiciona gerente/financeiro ao template bi_vendas.
--       SOMENTE a ação 'view': pela auditoria FASE A §5.2, gerente e
--       financeiro tinham APENAS bi_vendas.view (create/edit/delete/export
--       eram exclusivos de super_admin). A 125/1b removeu exatamente 2
--       linhas (gerente.view, financeiro.view); este rollback re-insere
--       essas 2 — não as 5 ações, para não criar write-grants fantasmas.
-- ------------------------------------------------------------
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
SELECT r.role_code, 'bi_vendas', 'view', true
FROM (VALUES ('gerente'),('financeiro')) AS r(role_code)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = true;

-- ------------------------------------------------------------
-- 1a' — Re-insere o override conhecido do gerente brunocasaletti@gmail.com
--       (5 ações × 3 módulos BI), se a conta existir
-- ------------------------------------------------------------
INSERT INTO public.user_permissions (user_id, unit_id, module, action, granted)
SELECT u.id, NULL::UUID, m.module, a.action, true
FROM public.users u
CROSS JOIN (VALUES ('bi'),('bi_atendimento'),('bi_vendas')) AS m(module)
CROSS JOIN (VALUES ('view'),('create'),('edit'),('delete'),('export')) AS a(action)
WHERE u.email = 'brunocasaletti@gmail.com'
ON CONFLICT (user_id, unit_id, module, action) DO UPDATE SET granted = true;

NOTIFY pgrst, 'reload schema';

COMMIT;
