-- ============================================
-- Migration 042: RPC para métricas de vendas do módulo BI
-- Tempo de fechamento, antecedência, ticket médio, receita
-- ============================================

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

    -- Deals ganhos no mês
    COUNT(*) FILTER (
      WHERE status_id = 2 OR stage_id = 60004787
    )::BIGINT AS won_deals,

    -- Receita total (soma de deal_amount dos ganhos com valor)
    COALESCE(SUM(deal_amount) FILTER (
      WHERE (status_id = 2 OR stage_id = 60004787)
        AND deal_amount > 0
    ), 0)::NUMERIC(14,2) AS total_revenue,

    -- Ticket médio (média de deal_amount dos ganhos com valor)
    ROUND(
      AVG(deal_amount) FILTER (
        WHERE (status_id = 2 OR stage_id = 60004787)
          AND deal_amount > 0
      ), 2
    )::NUMERIC(12,2) AS avg_ticket,

    -- Tempo médio de fechamento em dias
    -- Proxy: ploomes_last_update - ploomes_create_date para deals ganhos.
    -- Nota: ploomes_last_update reflete a última edição, não necessariamente
    -- o momento exato do fechamento — usar como referência aproximada.
    ROUND(
      AVG(
        EXTRACT(EPOCH FROM (ploomes_last_update - ploomes_create_date)) / 86400.0
      ) FILTER (
        WHERE (status_id = 2 OR stage_id = 60004787)
          AND ploomes_last_update IS NOT NULL
          AND ploomes_last_update > ploomes_create_date
      ), 1
    )::NUMERIC(6,1) AS avg_closing_days,

    -- Antecedência média de reserva em dias
    -- (event_date - data de criação do lead) para deals ganhos com data de festa
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

COMMENT ON FUNCTION get_bi_sales_metrics IS
  'Métricas de vendas por mês para o módulo BI.
   Ganho = status_id=2 (Ganho) OU stage_id=60004787 (Festa Fechada).
   Agrupado por mês de criação do lead (ploomes_create_date).
   avg_closing_days = ploomes_last_update - ploomes_create_date (proxy aproximado).
   avg_booking_advance_days = event_date - ploomes_create_date (dias antes da festa).';
