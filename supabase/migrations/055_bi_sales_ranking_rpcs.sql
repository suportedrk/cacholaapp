-- =============================================================
-- Migration 055: RPCs do painel "Vendas Realizadas (Orders)"
-- Guardados por role: super_admin, diretor, gerente, financeiro
-- Fonte: ploomes_orders JOIN sellers (owner_id)
-- =============================================================

BEGIN;

-- ---------------------------------------------------------------
-- RPC 1: KPI do card superior (faturamento, nº orders, ticket médio)
-- ---------------------------------------------------------------
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

-- ---------------------------------------------------------------
-- RPC 2: Ranking de vendedoras por receita
-- avg_monthly_revenue normalizado por meses trabalhados
-- respeitando hire_date / termination_date no período
-- ---------------------------------------------------------------
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
      -- Início efetivo: maior entre hire_date e início do filtro
      GREATEST(COALESCE(s.hire_date, p_start_date), p_start_date) AS eff_start,
      -- Fim efetivo: menor entre termination_date (se inativa) e fim do filtro
      LEAST(COALESCE(s.termination_date, p_end_date), p_end_date) AS eff_end
    FROM sellers s
    WHERE (p_include_inactive OR (s.status = 'active' AND s.is_system_account = FALSE))
      -- Exclui vendedoras contratadas após o final do período
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
    -- Meses trabalhados no período (mínimo 1 para evitar divisão por zero)
    -- DATE - DATE = INTEGER (dias); dividir por 30.4375 → meses (mínimo 1)
    GREATEST(1.0, (a.eff_end - a.eff_start)::NUMERIC / 30.4375)       AS months_worked,
    -- Receita média mensal normalizada
    CASE WHEN a.total_revenue > 0
         THEN a.total_revenue / GREATEST(1.0, (a.eff_end - a.eff_start)::NUMERIC / 30.4375)
         ELSE 0::NUMERIC
    END                                                                AS avg_monthly_revenue
  FROM aggregated a
  ORDER BY a.total_revenue DESC;
END;
$$;

-- ---------------------------------------------------------------
-- RPC 3: Drill-down — orders de uma vendedora no período
-- ---------------------------------------------------------------
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

COMMENT ON FUNCTION public.get_bi_sales_kpi IS
  'KPI do painel Vendas Realizadas: faturamento total, nº de orders e ticket médio no período';
COMMENT ON FUNCTION public.get_bi_sales_ranking IS
  'Ranking de vendedoras por receita. avg_monthly_revenue normalizado por meses trabalhados respeitando hire_date/termination_date';
COMMENT ON FUNCTION public.get_bi_seller_orders IS
  'Drill-down: lista orders de uma vendedora específica no período selecionado';

COMMIT;
