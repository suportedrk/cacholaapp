-- =============================================================
-- Migration 087: Fase C — Substituição de deal_amount/po.amount
--                por SUM(ploomes_order_products.total) em 11 RPCs de BI/Vendas
--
-- Afeta migrations: 042, 043, 051, 055, 059 (versão pos_vendas de 068)
-- Decisão: Opção A — soma_prod aplica apenas a deals Ganho; pipeline ativo
--          mantém deal_amount. Todos os critérios de ganho alinhados com 086:
--          status_id = 2 OR stage_id = 60004787
-- =============================================================

BEGIN;

-- =============================================================
-- 1. get_bi_sales_metrics (migration 042)
--    Substitui deal_amount por soma_prod via CTE prods
--    Remove AND deal_amount > 0; mantém AND soma_prod > 0 para avg_ticket
-- =============================================================
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
  WITH prods AS (
    SELECT
      po.deal_id,
      COALESCE(SUM(pop.total), 0) AS soma_prod
    FROM ploomes_orders po
    LEFT JOIN ploomes_order_products pop ON pop.order_id = po.ploomes_order_id
    GROUP BY po.deal_id
  )
  SELECT
    TO_CHAR(pd.ploomes_create_date, 'YYYY-MM') AS month,

    COUNT(*) FILTER (
      WHERE pd.status_id = 2 OR pd.stage_id = 60004787
    )::BIGINT AS won_deals,

    COALESCE(SUM(pr.soma_prod) FILTER (
      WHERE (pd.status_id = 2 OR pd.stage_id = 60004787)
        AND pr.soma_prod > 0
    ), 0)::NUMERIC(14,2) AS total_revenue,

    ROUND(
      AVG(pr.soma_prod) FILTER (
        WHERE (pd.status_id = 2 OR pd.stage_id = 60004787)
          AND pr.soma_prod > 0
      ), 2
    )::NUMERIC(12,2) AS avg_ticket,

    ROUND(
      AVG(
        EXTRACT(EPOCH FROM (pd.ploomes_last_update - pd.ploomes_create_date)) / 86400.0
      ) FILTER (
        WHERE (pd.status_id = 2 OR pd.stage_id = 60004787)
          AND pd.ploomes_last_update IS NOT NULL
          AND pd.ploomes_last_update > pd.ploomes_create_date
      ), 1
    )::NUMERIC(6,1) AS avg_closing_days,

    ROUND(
      AVG(
        (pd.event_date - pd.ploomes_create_date::date)::INTEGER
      ) FILTER (
        WHERE (pd.status_id = 2 OR pd.stage_id = 60004787)
          AND pd.event_date IS NOT NULL
          AND pd.event_date > pd.ploomes_create_date::date
      ), 1
    )::NUMERIC(6,1) AS avg_booking_advance_days

  FROM ploomes_deals pd
  LEFT JOIN prods pr ON pr.deal_id = pd.ploomes_deal_id
  WHERE
    (p_unit_id IS NULL OR pd.unit_id = p_unit_id)
    AND pd.ploomes_create_date >= DATE_TRUNC('month', CURRENT_DATE) - (p_months || ' months')::INTERVAL
  GROUP BY TO_CHAR(pd.ploomes_create_date, 'YYYY-MM')
  ORDER BY month DESC;
$$;

GRANT EXECUTE ON FUNCTION get_bi_sales_metrics TO authenticated;

COMMENT ON FUNCTION get_bi_sales_metrics IS
  'Métricas de vendas por mês para o módulo BI.
   Ganho = status_id=2 (Ganho) OU stage_id=60004787 (Festa Fechada).
   Receita = SUM(ploomes_order_products.total) via ploomes_orders.deal_id (Fase C).
   Agrupado por mês de criação do lead (ploomes_create_date).
   avg_closing_days = ploomes_last_update - ploomes_create_date (proxy aproximado).
   avg_booking_advance_days = event_date - ploomes_create_date (dias antes da festa).';


-- =============================================================
-- 2. get_bi_unit_comparison (migration 043)
--    Substitui pd.deal_amount por pr.soma_prod via CTE prods
--    Remove AND deal_amount > 0; mantém AND soma_prod > 0 para avg_ticket
--    get_bi_funnel_data não usa deal_amount — sem alteração
-- =============================================================
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

    COALESCE(SUM(pr.soma_prod) FILTER (
      WHERE (pd.status_id = 2 OR pd.stage_id = 60004787) AND pr.soma_prod > 0
    ), 0)::NUMERIC(14,2) AS total_revenue,

    ROUND(AVG(pr.soma_prod) FILTER (
      WHERE (pd.status_id = 2 OR pd.stage_id = 60004787) AND pr.soma_prod > 0
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
  LEFT JOIN prods pr ON pr.deal_id = pd.ploomes_deal_id
  WHERE pd.ploomes_create_date >= DATE_TRUNC('month', CURRENT_DATE) - (p_months || ' months')::INTERVAL
  GROUP BY pd.unit_id, u.name
  ORDER BY total_leads DESC;
$$;

GRANT EXECUTE ON FUNCTION get_bi_unit_comparison TO authenticated;

COMMENT ON FUNCTION get_bi_unit_comparison IS
  'Comparativo de métricas entre unidades nos últimos p_months meses.
   Ganho = status_id=2 OU stage_id=60004787 (Festa Fechada).
   Receita = SUM(ploomes_order_products.total) via ploomes_orders.deal_id (Fase C).
   Agrupado por unidade. avg_closing_days = proxy via ploomes_last_update.';


-- =============================================================
-- 3. get_bi_sellers_ranking (migration 051)
--    Corrige critério: status_id=2 → (status_id=2 OR stage_id=60004787)
--    Substitui deal_amount por soma_prod via CTE prods
-- =============================================================
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
$$;

COMMENT ON FUNCTION public.get_bi_sellers_ranking IS
  'Ranking de vendedoras por período. Acesso: super_admin + diretor. Ordena por receita DESC.
   Critério ganho alinhado: status_id=2 OR stage_id=60004787 (Fase C).
   Receita = SUM(ploomes_order_products.total) via ploomes_orders.deal_id.';

GRANT EXECUTE ON FUNCTION public.get_bi_sellers_ranking(UUID, INTEGER) TO authenticated;


-- =============================================================
-- 4. get_bi_seller_history (migration 051)
--    Corrige critério: status_id=2 → (status_id=2 OR stage_id=60004787)
--    Substitui deal_amount por soma_prod via CTE prods
-- =============================================================
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
$$;

COMMENT ON FUNCTION public.get_bi_seller_history IS
  'Série mensal de leads/ganhos/receita/tempo de fechamento de uma vendedora.
   Critério ganho alinhado: status_id=2 OR stage_id=60004787 (Fase C).
   Receita = SUM(ploomes_order_products.total) via ploomes_orders.deal_id.
   avg_days_to_close: proxy ploomes_last_update.';

GRANT EXECUTE ON FUNCTION public.get_bi_seller_history(TEXT, UUID, INTEGER) TO authenticated;


-- =============================================================
-- 5. get_bi_seller_funnel (migration 051)
--    Ajuste 2: nova classificação de buckets
--      em_aberto = status_id=1 AND stage_id <> 60004787
--      ganhos    = status_id=2 OR stage_id=60004787
--      perdidos  = status_id=3
--    Substitui deal_amount por soma_prod apenas para ganhos
--    Para em_aberto e perdidos mantém deal_amount (pipeline ativo + Opção A)
-- =============================================================
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
$$;

COMMENT ON FUNCTION public.get_bi_seller_funnel IS
  'Funil simplificado: 3 buckets (em_aberto/ganhos/perdidos) sem detalhe por estágio.
   Bucket ganhos = status_id=2 OR stage_id=60004787 (Ajuste 2, Fase C).
   Valor ganhos = SUM(ploomes_order_products.total); demais = deal_amount (pipeline ativo).';

GRANT EXECUTE ON FUNCTION public.get_bi_seller_funnel(TEXT, UUID, INTEGER) TO authenticated;


-- =============================================================
-- 6. get_bi_sales_kpi (migration 055)
--    Substitui po.amount por SUM(pop.total)
--    COUNT(*) → COUNT(DISTINCT po.ploomes_order_id) por causa do LEFT JOIN
-- =============================================================
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
$$;

COMMENT ON FUNCTION public.get_bi_sales_kpi IS
  'KPI do painel Vendas Realizadas: faturamento total, nº de orders e ticket médio no período.
   Receita = SUM(ploomes_order_products.total) por order (Fase C).';


-- =============================================================
-- 7. get_bi_sales_ranking (migration 055)
--    Substitui po.amount por SUM(pop.total) no CTE aggregated
--    COUNT(po.ploomes_order_id) → COUNT(DISTINCT) por causa do LEFT JOIN
-- =============================================================
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
$$;

COMMENT ON FUNCTION public.get_bi_sales_ranking IS
  'Ranking de vendedoras por receita. avg_monthly_revenue normalizado por meses trabalhados.
   Receita = SUM(ploomes_order_products.total) por order (Fase C).';


-- =============================================================
-- 8. get_bi_seller_orders (migration 055)
--    Ajuste 1: substitui po.amount por COALESCE(ops.soma_prod, 0)
--    Sem fallback para po.amount (consistência com KPI header)
-- =============================================================
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
$$;

COMMENT ON FUNCTION public.get_bi_seller_orders IS
  'Drill-down: lista orders de uma vendedora específica no período selecionado.
   amount = SUM(ploomes_order_products.total) por order (Fase C, Ajuste 1).';


-- =============================================================
-- 9. get_vendas_my_kpis (migration 059 atualizada pela 068)
--    Substitui po.amount por soma_prod via CTE order_prods
--    Preserva guard pos_vendas da migration 068
-- =============================================================
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
  order_prods AS (
    SELECT
      po.ploomes_order_id,
      po.date,
      po.owner_id,
      COALESCE(SUM(pop.total), 0) AS soma_prod
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


-- =============================================================
-- 10. get_vendas_daily_revenue (migration 059 atualizada pela 068)
--     Substitui po.amount por SUM(pop.total) via CTE
--     Preserva guard pos_vendas da migration 068
-- =============================================================
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
  WITH order_prods AS (
    SELECT
      po.date,
      COALESCE(SUM(pop.total), 0) AS soma_prod
    FROM public.ploomes_orders po
    LEFT JOIN public.ploomes_order_products pop ON pop.order_id = po.ploomes_order_id
    WHERE po.date BETWEEN p_start_date AND p_end_date
      AND (v_eff_seller IS NULL OR po.owner_id = v_owner_int)
    GROUP BY po.ploomes_order_id, po.date
  )
  SELECT
    op.date::DATE                                                              AS order_date,
    SUM(op.soma_prod)::NUMERIC                                                 AS revenue,
    SUM(SUM(op.soma_prod)) OVER (ORDER BY op.date)::NUMERIC                    AS cumulative_revenue
  FROM order_prods op
  GROUP BY op.date
  ORDER BY op.date;
END;
$$;


-- =============================================================
-- 11. get_vendas_ranking (migration 059 atualizada pela 068)
--     DROP + CREATE porque RETURNS TABLE mudou em migration 060
--     Substitui po.amount por SUM(pop.total)
--     COUNT(po.ploomes_order_id) → COUNT(DISTINCT) por causa do LEFT JOIN
--     Preserva guard pos_vendas e estrutura deals_by_owner da migration 068
-- =============================================================
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
  order_prods AS (
    SELECT
      po.ploomes_order_id,
      po.owner_id,
      COALESCE(SUM(pop.total), 0) AS soma_prod
    FROM public.ploomes_orders po
    LEFT JOIN public.ploomes_order_products pop ON pop.order_id = po.ploomes_order_id
    WHERE po.date BETWEEN p_start_date AND p_end_date
      AND (p_unit_id IS NULL OR po.unit_id = p_unit_id)
    GROUP BY po.ploomes_order_id, po.owner_id
  ),
  ranked_sellers AS (
    SELECT
      s.id                                                               AS seller_id,
      s.name                                                             AS seller_name,
      s.owner_id                                                         AS s_owner_id,
      COALESCE(SUM(op.soma_prod), 0)::NUMERIC                            AS total_revenue,
      COUNT(DISTINCT op.ploomes_order_id)::INTEGER                       AS order_count
    FROM public.sellers s
    LEFT JOIN order_prods op ON op.owner_id = s.owner_id
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
