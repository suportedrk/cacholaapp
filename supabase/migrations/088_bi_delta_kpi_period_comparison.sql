-- ============================================================
-- Migration 088: Frente 2.2 — Delta KPI cards (period vs prior)
--
-- Modifica: get_bi_sales_metrics, get_bi_conversion_data
-- Adiciona: parâmetros p_prev_start DATE / p_prev_end DATE (opcionais, DEFAULT NULL)
-- Adiciona: colunas prev_* no RETURNS (NULL quando p_prev_start IS NULL)
-- NÃO modifica: get_bi_unit_comparison (fora de escopo)
-- Compatibilidade reversa: chamadas sem os novos parâmetros retornam prev_* = NULL
-- ============================================================

BEGIN;

-- Dropar versões anteriores (2 parâmetros) para evitar ambiguidade de sobrecarga
-- após CREATE OR REPLACE com 4 parâmetros.
DROP FUNCTION IF EXISTS public.get_bi_sales_metrics(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.get_bi_conversion_data(UUID, INTEGER);

-- ============================================================
-- 1. get_bi_sales_metrics
--    Adiciona p_prev_start, p_prev_end + 5 colunas prev_*
--    WITH prev_agg vazia quando p_prev_start/p_prev_end IS NULL →
--    LEFT JOIN ON true produz NULL em todas pa.* (comportamento esperado)
-- ============================================================
CREATE OR REPLACE FUNCTION get_bi_sales_metrics(
  p_unit_id    UUID    DEFAULT NULL,
  p_months     INTEGER DEFAULT 7,
  p_prev_start DATE    DEFAULT NULL,
  p_prev_end   DATE    DEFAULT NULL
)
RETURNS TABLE (
  month                     TEXT,
  won_deals                 BIGINT,
  total_revenue             NUMERIC(14,2),
  avg_ticket                NUMERIC(12,2),
  avg_closing_days          NUMERIC(6,1),
  avg_booking_advance_days  NUMERIC(6,1),
  prev_revenue              NUMERIC(14,2),
  prev_won_deals            BIGINT,
  prev_avg_ticket           NUMERIC(12,2),
  prev_avg_closing_days     NUMERIC(6,1),
  prev_avg_advance_days     NUMERIC(6,1)
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
  ),
  prev_agg AS (
    -- Agregados do período anterior (1 linha escalar sempre).
    -- CASE WHEN garante NULL em todas as colunas quando p_prev_start/p_prev_end não fornecidos,
    -- evitando que COUNT(*)/SUM sobre 0 linhas retorne 0 indevidamente.
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

    pa.prev_revenue,
    pa.prev_won_deals,
    pa.prev_avg_ticket,
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
$$;

GRANT EXECUTE ON FUNCTION get_bi_sales_metrics(UUID, INTEGER, DATE, DATE) TO authenticated;

COMMENT ON FUNCTION get_bi_sales_metrics(UUID, INTEGER, DATE, DATE) IS
  'Métricas de vendas por mês para o módulo BI.
   Ganho = status_id=2 (Ganho) OU stage_id=60004787 (Festa Fechada).
   Receita = SUM(ploomes_order_products.total) via ploomes_orders.deal_id (Fase C).
   Agrupado por mês de criação do lead (ploomes_create_date).
   avg_closing_days = ploomes_last_update - ploomes_create_date (proxy aproximado).
   avg_booking_advance_days = event_date - ploomes_create_date (dias antes da festa).
   p_prev_start/p_prev_end opcionais: quando fornecidos, retornam prev_* com agregados
   do período anterior (escalar repetido em todas as linhas). Frente 2.2.';


-- ============================================================
-- 2. get_bi_conversion_data
--    Adiciona p_prev_start, p_prev_end + 3 colunas prev_*
--    Mesmo padrão: prev_agg vazia → LEFT JOIN ON true → NULL
-- ============================================================
CREATE OR REPLACE FUNCTION get_bi_conversion_data(
  p_unit_id    UUID    DEFAULT NULL,
  p_months     INTEGER DEFAULT 7,
  p_prev_start DATE    DEFAULT NULL,
  p_prev_end   DATE    DEFAULT NULL
)
RETURNS TABLE (
  month                TEXT,
  total_leads          BIGINT,
  won_leads            BIGINT,
  conversion_rate      NUMERIC(5,2),
  prev_total_leads     BIGINT,
  prev_won_leads       BIGINT,
  prev_conversion_rate NUMERIC(5,2)
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH prev_agg AS (
    -- Mesmo padrão de get_bi_sales_metrics: CASE WHEN garante NULL quando
    -- p_prev_start/p_prev_end ausentes; BETWEEN 'infinity'/'-infinity' zera a varredura.
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
$$;

GRANT EXECUTE ON FUNCTION get_bi_conversion_data(UUID, INTEGER, DATE, DATE) TO authenticated;

COMMENT ON FUNCTION get_bi_conversion_data(UUID, INTEGER, DATE, DATE) IS
  'Dados de conversão por mês para o módulo BI.
   Won = status_id=2 (Ganho) OU stage_id=60004787 (Festa Fechada).
   Agrupa por ploomes_create_date (data real de criação no CRM).
   p_prev_start/p_prev_end opcionais: quando fornecidos, retornam prev_* com agregados
   do período anterior (escalar repetido em todas as linhas). Frente 2.2.';

COMMIT;
