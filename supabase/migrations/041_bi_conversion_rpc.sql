-- ============================================
-- Migration 041: RPC para dados de conversão do módulo BI
-- ============================================

CREATE OR REPLACE FUNCTION get_bi_conversion_data(
  p_unit_id UUID DEFAULT NULL,
  p_months  INTEGER DEFAULT 7
)
RETURNS TABLE (
  month           TEXT,
  total_leads     BIGINT,
  won_leads       BIGINT,
  conversion_rate NUMERIC(5,2)
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    TO_CHAR(ploomes_create_date, 'YYYY-MM') AS month,
    COUNT(*)::BIGINT AS total_leads,
    COUNT(*) FILTER (
      WHERE status_id = 2        -- Ganho (status formal)
         OR stage_id = 60004787  -- Festa Fechada (confirmada)
    )::BIGINT AS won_leads,
    CASE
      WHEN COUNT(*) = 0 THEN NULL
      ELSE ROUND(
        COUNT(*) FILTER (
          WHERE status_id = 2 OR stage_id = 60004787
        )::NUMERIC / COUNT(*)::NUMERIC * 100,
        2
      )
    END AS conversion_rate
  FROM ploomes_deals
  WHERE
    (p_unit_id IS NULL OR unit_id = p_unit_id)
    AND ploomes_create_date >= DATE_TRUNC('month', CURRENT_DATE) - (p_months || ' months')::INTERVAL
  GROUP BY TO_CHAR(ploomes_create_date, 'YYYY-MM')
  ORDER BY month DESC;
$$;

GRANT EXECUTE ON FUNCTION get_bi_conversion_data TO authenticated;

COMMENT ON FUNCTION get_bi_conversion_data IS
  'Dados de conversão por mês para o módulo BI.
   Won = status_id=2 (Ganho) OU stage_id=60004787 (Festa Fechada).
   Agrupa por ploomes_create_date (data real de criação no CRM).';
