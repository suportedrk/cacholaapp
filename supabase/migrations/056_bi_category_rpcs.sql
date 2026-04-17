-- =============================================================
-- Migration 056: RPCs de "Vendas por Categoria de Produto"
-- Guardados por role: super_admin, diretor, gerente, financeiro
-- Fonte: ploomes_order_products JOIN sellers (owner_id)
-- Campos usados: group_name (categoria), total (valor), product_name
-- FK local: ploomes_order_products.order_id → ploomes_orders.ploomes_order_id
-- Colunas desnormalizadas em ploomes_order_products: unit_id, order_date, owner_id
-- Cobertura confirmada: 100% das orders têm produtos (1538/1538 em abr/2026)
-- =============================================================

BEGIN;

-- ---------------------------------------------------------------
-- RPC 1: KPI do painel de categorias
-- Retorna: nº de categorias distintas, categoria líder, total de itens
-- (cobertura removida pois é 100% — ver decisão de produto abr/2026)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_bi_category_kpi(
  p_start_date        DATE,
  p_end_date          DATE,
  p_unit_id           UUID    DEFAULT NULL,
  p_include_inactive  BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  total_categories      BIGINT,
  top_category_name     TEXT,
  top_category_revenue  NUMERIC,
  total_items           BIGINT
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
  WITH base AS (
    SELECT
      COALESCE(NULLIF(TRIM(pop.group_name), ''), 'Sem classificação') AS category,
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
    (SELECT COUNT(*) FROM by_cat)::BIGINT              AS total_categories,
    (SELECT category FROM top_cat)                     AS top_category_name,
    (SELECT revenue  FROM top_cat)                     AS top_category_revenue,
    (SELECT COUNT(*) FROM base)::BIGINT                AS total_items;
END;
$$;

-- ---------------------------------------------------------------
-- RPC 2: Ranking de categorias por receita
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_bi_category_ranking(
  p_start_date        DATE,
  p_end_date          DATE,
  p_unit_id           UUID    DEFAULT NULL,
  p_include_inactive  BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  category            TEXT,
  revenue             NUMERIC,
  product_count       BIGINT,
  avg_product_ticket  NUMERIC,
  pct_of_total        NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_revenue NUMERIC;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'diretor', 'gerente', 'financeiro')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  -- Receita total de referência para calcular % do total
  SELECT COALESCE(SUM(pop.total), 0)
  INTO v_total_revenue
  FROM ploomes_order_products pop
  JOIN sellers s ON s.owner_id = pop.owner_id
  WHERE pop.order_date BETWEEN p_start_date AND p_end_date
    AND (p_unit_id IS NULL OR pop.unit_id = p_unit_id)
    AND (p_include_inactive OR (s.status = 'active' AND s.is_system_account = FALSE));

  RETURN QUERY
  SELECT
    COALESCE(NULLIF(TRIM(pop.group_name), ''), 'Sem classificação')::TEXT   AS category,
    COALESCE(SUM(pop.total), 0)::NUMERIC                                    AS revenue,
    COUNT(*)::BIGINT                                                         AS product_count,
    CASE WHEN COUNT(*) > 0
         THEN (SUM(pop.total) / COUNT(*))::NUMERIC
         ELSE 0::NUMERIC
    END                                                                      AS avg_product_ticket,
    CASE WHEN v_total_revenue > 0
         THEN ROUND((SUM(pop.total) / v_total_revenue * 100)::NUMERIC, 1)
         ELSE 0::NUMERIC
    END                                                                      AS pct_of_total
  FROM ploomes_order_products pop
  JOIN sellers s ON s.owner_id = pop.owner_id
  WHERE pop.order_date BETWEEN p_start_date AND p_end_date
    AND (p_unit_id IS NULL OR pop.unit_id = p_unit_id)
    AND (p_include_inactive OR (s.status = 'active' AND s.is_system_account = FALSE))
  GROUP BY 1
  ORDER BY revenue DESC;
END;
$$;

-- ---------------------------------------------------------------
-- RPC 3: Drill-down de uma categoria
-- Retorna produtos da categoria + top 5 vendedoras (diferenciados por kind)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_bi_category_drilldown(
  p_category          TEXT,
  p_start_date        DATE,
  p_end_date          DATE,
  p_unit_id           UUID    DEFAULT NULL,
  p_include_inactive  BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  kind           TEXT,   -- 'product' | 'seller'
  item_name      TEXT,
  item_revenue   NUMERIC,
  item_count     BIGINT,
  item_avg       NUMERIC,
  rank_position  INT
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
  WITH filtered AS (
    SELECT
      pop.product_name,
      pop.owner_name,
      pop.total
    FROM ploomes_order_products pop
    JOIN sellers s ON s.owner_id = pop.owner_id
    WHERE COALESCE(NULLIF(TRIM(pop.group_name), ''), 'Sem classificação') = p_category
      AND pop.order_date BETWEEN p_start_date AND p_end_date
      AND (p_unit_id IS NULL OR pop.unit_id = p_unit_id)
      AND (p_include_inactive OR (s.status = 'active' AND s.is_system_account = FALSE))
  ),
  products AS (
    SELECT
      product_name                                                                  AS item_name,
      SUM(total)::NUMERIC                                                           AS item_revenue,
      COUNT(*)::BIGINT                                                              AS item_count,
      (SUM(total) / COUNT(*))::NUMERIC                                              AS item_avg
    FROM filtered
    GROUP BY product_name
  ),
  sellers_agg AS (
    SELECT
      owner_name                                                                    AS item_name,
      SUM(total)::NUMERIC                                                           AS item_revenue,
      COUNT(*)::BIGINT                                                              AS item_count,
      (SUM(total) / COUNT(*))::NUMERIC                                              AS item_avg
    FROM filtered
    WHERE owner_name IS NOT NULL
    GROUP BY owner_name
    ORDER BY item_revenue DESC
    LIMIT 5
  )
  SELECT
    'product'::TEXT                                                                 AS kind,
    p.item_name,
    p.item_revenue,
    p.item_count,
    p.item_avg,
    ROW_NUMBER() OVER (ORDER BY p.item_revenue DESC)::INT                          AS rank_position
  FROM products p
  UNION ALL
  SELECT
    'seller'::TEXT                                                                  AS kind,
    sa.item_name,
    sa.item_revenue,
    sa.item_count,
    sa.item_avg,
    ROW_NUMBER() OVER (ORDER BY sa.item_revenue DESC)::INT                         AS rank_position
  FROM sellers_agg sa
  ORDER BY kind ASC, rank_position ASC;  -- 'product' < 'seller' → products first, then sellers
END;
$$;

COMMENT ON FUNCTION public.get_bi_category_kpi IS
  'KPI do painel Vendas por Categoria: nº de categorias, categoria líder e total de itens vendidos';
COMMENT ON FUNCTION public.get_bi_category_ranking IS
  'Ranking de categorias de produto por receita com % do total; base: ploomes_order_products.total';
COMMENT ON FUNCTION public.get_bi_category_drilldown IS
  'Drill-down: produtos da categoria (kind=product) + top 5 vendedoras (kind=seller), ordenado por rank_position dentro de cada kind';

COMMIT;
