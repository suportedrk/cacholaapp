-- =============================================================
-- Migration 057: Normalize product categories + cross-unit detection
-- Adds normalize_product_category() helper (strips unit suffix from group_name)
-- Refactors 3 existing category RPCs to use normalized names
-- get_bi_category_ranking gains p_group_by_unit + unit_family return column
-- New get_bi_category_cross_unit RPC for alert card in UI
-- NOTE: DROP required before CREATE — RETURNS TABLE schema changes
-- Family: "Cachola PINHEIROS" / "Cachola MOEMA" — 100% populated (3096/3096)
-- =============================================================

BEGIN;

-- ---------------------------------------------------------------
-- 1. normalize_product_category — strips " Cachola <UNIT>" suffix
--    "Pacotes Cachola PINHEIROS" → "Pacotes"
--    "Adicionais Cachola MOEMA"  → "Adicionais"
--    ""  / NULL                  → "Sem classificação"
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_product_category(p_group_name TEXT)
RETURNS TEXT
IMMUTABLE
LANGUAGE sql
AS $$
  SELECT COALESCE(
    NULLIF(TRIM(REGEXP_REPLACE(COALESCE(p_group_name, ''), '\s+Cachola\s+.*$', '', 'i')), ''),
    'Sem classificação'
  )
$$;

COMMENT ON FUNCTION public.normalize_product_category IS
  'Strips " Cachola <UNIT>" suffix from ploomes_order_products.group_name returning the canonical category name';

-- ---------------------------------------------------------------
-- 2. Index on family_name (speeds up cross-unit query + ranking group-by)
-- ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ploomes_order_products_family
  ON public.ploomes_order_products(family_name);

-- ---------------------------------------------------------------
-- 3. DROP existing category RPCs — RETURNS TABLE schema changes prevent
--    CREATE OR REPLACE without drop (PostgreSQL restriction)
-- ---------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_bi_category_kpi(DATE, DATE, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.get_bi_category_ranking(DATE, DATE, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.get_bi_category_drilldown(TEXT, DATE, DATE, UUID, BOOLEAN);

-- ---------------------------------------------------------------
-- 4. get_bi_category_kpi — uses normalized category names
-- ---------------------------------------------------------------
CREATE FUNCTION public.get_bi_category_kpi(
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
$$;

-- ---------------------------------------------------------------
-- 5. get_bi_category_ranking — adds p_group_by_unit flag
--    When FALSE (default): 3 rows (Pacotes / Adicionais / Upgrades), unit_family = NULL
--    When TRUE:            up to 6 rows grouped by (category, family_name)
-- ---------------------------------------------------------------
CREATE FUNCTION public.get_bi_category_ranking(
  p_start_date        DATE,
  p_end_date          DATE,
  p_unit_id           UUID    DEFAULT NULL,
  p_include_inactive  BOOLEAN DEFAULT FALSE,
  p_group_by_unit     BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  category            TEXT,
  unit_family         TEXT,
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
$$;

-- ---------------------------------------------------------------
-- 6. get_bi_category_drilldown — p_category now matches normalized name
-- ---------------------------------------------------------------
CREATE FUNCTION public.get_bi_category_drilldown(
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
$$;

-- ---------------------------------------------------------------
-- 7. get_bi_category_cross_unit — detects items where order unit ≠ product family
--    E.g. a Pinheiros order with a MOEMA-family product (or vice-versa)
--    No p_unit_id filter — always returns global cross-unit picture
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_bi_category_cross_unit(
  p_start_date        DATE,
  p_end_date          DATE,
  p_include_inactive  BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  order_unit_name  TEXT,
  product_family   TEXT,
  item_count       BIGINT,
  revenue          NUMERIC
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
$$;

-- ---------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------
COMMENT ON FUNCTION public.get_bi_category_kpi IS
  'KPI do painel Vendas por Categoria: nº de categorias normalizadas, categoria líder e total de itens';
COMMENT ON FUNCTION public.get_bi_category_ranking IS
  'Ranking de categorias normalizadas por receita; p_group_by_unit=TRUE desagrega por family_name';
COMMENT ON FUNCTION public.get_bi_category_drilldown IS
  'Drill-down: produtos da categoria normalizada (kind=product) + top 5 vendedoras (kind=seller)';
COMMENT ON FUNCTION public.get_bi_category_cross_unit IS
  'Detecta itens onde unidade do pedido (unit_id) difere da família do produto (family_name)';

COMMIT;
