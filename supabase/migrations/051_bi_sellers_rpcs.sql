-- =============================================================
-- Migration 051 — BI Dashboard de Vendedoras
-- 3 RPCs + índice de performance
-- Ajustes aprovados:
--   (A) FROM users (não user_profiles — tabela inexistente)
--   (B) ploomes_last_update como proxy de fechamento (não updated_at)
--   Guard: super_admin + diretor apenas
-- =============================================================

BEGIN;

-- =============================================================
-- RPC 1: Ranking de vendedoras
-- Retorna 1 linha por vendedora com métricas agregadas
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
  -- Guard: apenas super_admin ou diretor
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'diretor')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  v_start_date := CURRENT_DATE - (p_period_months || ' months')::INTERVAL;

  RETURN QUERY
  SELECT
    pd.owner_name,
    COUNT(*)::BIGINT                                                           AS leads_count,
    COUNT(*) FILTER (WHERE pd.status_id = 2)::BIGINT                          AS won_count,
    COUNT(*) FILTER (WHERE pd.status_id = 3)::BIGINT                          AS lost_count,
    COUNT(*) FILTER (WHERE pd.status_id = 1)::BIGINT                          AS open_count,
    CASE
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND(
        COUNT(*) FILTER (WHERE pd.status_id = 2)::NUMERIC
        / COUNT(*)::NUMERIC * 100, 1
      )
    END                                                                        AS conversion_rate,
    COALESCE(AVG(pd.deal_amount) FILTER (WHERE pd.status_id = 2), 0)::NUMERIC AS avg_ticket,
    COALESCE(SUM(pd.deal_amount) FILTER (WHERE pd.status_id = 2), 0)::NUMERIC AS total_revenue
  FROM public.ploomes_deals pd
  WHERE pd.owner_name IS NOT NULL
    AND pd.ploomes_create_date >= v_start_date
    AND (p_unit_id IS NULL OR pd.unit_id = p_unit_id)
  GROUP BY pd.owner_name
  ORDER BY total_revenue DESC;
END;
$$;

COMMENT ON FUNCTION public.get_bi_sellers_ranking IS
  'Ranking de vendedoras por período. Acesso: super_admin + diretor. Ordena por receita DESC.';

GRANT EXECUTE ON FUNCTION public.get_bi_sellers_ranking(UUID, INTEGER) TO authenticated;


-- =============================================================
-- RPC 2: Histórico mensal de uma vendedora
-- Série temporal: leads, ganhos, receita, tempo médio fechamento
-- Usa ploomes_last_update como proxy da data de fechamento (B)
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_bi_seller_history(
  p_owner_name    TEXT,
  p_unit_id       UUID    DEFAULT NULL,
  p_period_months INTEGER DEFAULT 6
)
RETURNS TABLE (
  month_label        TEXT,    -- 'YYYY-MM'
  leads_count        BIGINT,
  won_count          BIGINT,
  revenue            NUMERIC,
  avg_days_to_close  NUMERIC  -- NULL quando não há ganhos no mês
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
  SELECT
    TO_CHAR(DATE_TRUNC('month', pd.ploomes_create_date), 'YYYY-MM') AS month_label,
    COUNT(*)::BIGINT                                                 AS leads_count,
    COUNT(*) FILTER (WHERE pd.status_id = 2)::BIGINT                AS won_count,
    COALESCE(
      SUM(pd.deal_amount) FILTER (WHERE pd.status_id = 2), 0
    )::NUMERIC                                                       AS revenue,
    -- (B) ploomes_last_update como proxy da data de fechamento
    ROUND(
      AVG(
        EXTRACT(EPOCH FROM (pd.ploomes_last_update - pd.ploomes_create_date)) / 86400.0
      ) FILTER (WHERE pd.status_id = 2),
      1
    )::NUMERIC                                                       AS avg_days_to_close
  FROM public.ploomes_deals pd
  WHERE pd.owner_name = p_owner_name
    AND pd.ploomes_create_date >= v_start_date
    AND (p_unit_id IS NULL OR pd.unit_id = p_unit_id)
  GROUP BY DATE_TRUNC('month', pd.ploomes_create_date)
  ORDER BY DATE_TRUNC('month', pd.ploomes_create_date);
END;
$$;

COMMENT ON FUNCTION public.get_bi_seller_history IS
  'Série mensal de leads/ganhos/receita/tempo de fechamento de uma vendedora. Proxy: ploomes_last_update.';

GRANT EXECUTE ON FUNCTION public.get_bi_seller_history(TEXT, UUID, INTEGER) TO authenticated;


-- =============================================================
-- RPC 3: Funil simplificado de uma vendedora
-- Apenas 3 buckets: em_aberto | ganhos | perdidos (sem estágio)
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_bi_seller_funnel(
  p_owner_name    TEXT,
  p_unit_id       UUID    DEFAULT NULL,
  p_period_months INTEGER DEFAULT 6
)
RETURNS TABLE (
  bucket       TEXT,    -- 'em_aberto' | 'ganhos' | 'perdidos'
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
  SELECT
    CASE pd.status_id
      WHEN 1 THEN 'em_aberto'
      WHEN 2 THEN 'ganhos'
      WHEN 3 THEN 'perdidos'
    END::TEXT                                  AS bucket,
    COUNT(*)::BIGINT                           AS deals_count,
    COALESCE(SUM(pd.deal_amount), 0)::NUMERIC  AS total_value
  FROM public.ploomes_deals pd
  WHERE pd.owner_name = p_owner_name
    AND pd.ploomes_create_date >= v_start_date
    AND pd.status_id IN (1, 2, 3)
    AND (p_unit_id IS NULL OR pd.unit_id = p_unit_id)
  GROUP BY pd.status_id
  ORDER BY pd.status_id;
END;
$$;

COMMENT ON FUNCTION public.get_bi_seller_funnel IS
  'Funil simplificado: 3 buckets (em_aberto/ganhos/perdidos) sem detalhe por estágio. v1.';

GRANT EXECUTE ON FUNCTION public.get_bi_seller_funnel(TEXT, UUID, INTEGER) TO authenticated;


-- =============================================================
-- Índice composto para acelerar os 3 RPCs
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_ploomes_deals_owner_create_date
  ON public.ploomes_deals (owner_name, ploomes_create_date, status_id)
  WHERE owner_name IS NOT NULL;

COMMIT;
