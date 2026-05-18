-- supabase/migrations/093_can_view_festa_values_and_masking.sql
-- Frente Permissões de Valor v1.11.0 — Fase 2 Backend
--
-- Objetivo: impedir que roles não autorizadas vejam valores monetários de festa.
-- Roles BLOQUEADAS: manutencao, rh, freelancer, entregador.
-- Roles AUTORIZADAS: super_admin, diretor, gerente, vendedora, pos_vendas, decoracao, financeiro.
--
-- Alterações:
--   1. Nova função STABLE SECURITY DEFINER: can_view_festa_values(uuid)
--   2. pre_reservas_ploomes_view: deal_amount → CASE WHEN can_view_festa_values()
--   3. get_bi_sales_metrics: mascara total_revenue, avg_ticket, prev_revenue, prev_avg_ticket
--   4. get_bi_unit_comparison: mascara total_revenue, avg_ticket
--   5. NOTIFY pgrst 'reload schema' para PostgREST reconhecer a nova função

BEGIN;

-- ─── 1. Função helper de autorização ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.can_view_festa_values(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id
      AND role IN (
        'super_admin', 'diretor', 'gerente',
        'vendedora', 'pos_vendas', 'decoracao', 'financeiro'
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_view_festa_values(uuid) TO authenticated, anon;

COMMENT ON FUNCTION public.can_view_festa_values IS
  'Retorna true se o usuário pode ver valores monetários de festa (deal_amount, etc.). '
  'Roles autorizadas: super_admin, diretor, gerente, vendedora, pos_vendas, decoracao, financeiro. '
  'Roles bloqueadas: manutencao, rh, freelancer, entregador. '
  'Frente Permissões de Valor v1.11.0.';

-- ─── 2. Patch em pre_reservas_ploomes_view ───────────────────────────────────
-- Mantém estrutura idêntica à migration 090; substitui pd.deal_amount por CASE WHEN.

DROP VIEW IF EXISTS public.pre_reservas_ploomes_view;

CREATE VIEW public.pre_reservas_ploomes_view
WITH (security_invoker = true)
AS
SELECT
  pd.ploomes_deal_id::text                                                     AS id,
  pd.ploomes_deal_id                                                            AS deal_id,
  COALESCE(o.chosen_unit_id, pd.unit_id)                                       AS unit_id,
  CASE
    WHEN o.chosen_unit_id IS NOT NULL THEN 'order'::text
    ELSE 'deal'::text
  END                                                                           AS unit_source,
  pd.event_date                                                                 AS date,
  pd.start_time,
  pd.end_time,
  pd.contact_name                                                               AS client_name,
  pd.contact_phone                                                              AS client_contact,
  pd.title                                                                      AS deal_title,
  CASE WHEN can_view_festa_values() THEN pd.deal_amount ELSE NULL END          AS deal_amount,
  pd.stage_id,
  pd.stage_name,
  pd.owner_name,
  pd.created_at,
  pd.updated_at,
  'https://app10.ploomes.com/deal/' || pd.ploomes_deal_id::text                AS ploomes_url,
  'ploomes'::text                                                               AS source
FROM public.ploomes_deals pd
LEFT JOIN LATERAL (
  SELECT chosen_unit_id
  FROM public.ploomes_orders
  WHERE deal_id = pd.ploomes_deal_id
    AND chosen_unit_id IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1
) o ON true
WHERE pd.status_id = 1
  AND pd.stage_id IN (60004416, 60056754)
  AND pd.event_date IS NOT NULL
  AND pd.event_date >= CURRENT_DATE - INTERVAL '7 days';

GRANT SELECT ON public.pre_reservas_ploomes_view TO authenticated;

-- ─── 3. Patch em get_bi_sales_metrics ───────────────────────────────────────
-- Campos monetários mascarados no SELECT final: total_revenue, avg_ticket,
-- prev_revenue, prev_avg_ticket.
-- Campos não-monetários intocados: won_deals, avg_closing_days,
-- avg_booking_advance_days, prev_won_deals, prev_avg_closing_days, prev_avg_advance_days.
-- Cálculos internos (CTEs prods, prev_agg) preservados integralmente.

DROP FUNCTION IF EXISTS public.get_bi_sales_metrics(UUID, INTEGER, DATE, DATE);

CREATE OR REPLACE FUNCTION public.get_bi_sales_metrics(
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
SET search_path = public
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
    -- CASE WHEN garante NULL em todas as colunas quando p_prev_start/p_prev_end não fornecidos.
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
$$;

GRANT EXECUTE ON FUNCTION public.get_bi_sales_metrics(UUID, INTEGER, DATE, DATE) TO authenticated;

COMMENT ON FUNCTION public.get_bi_sales_metrics(UUID, INTEGER, DATE, DATE) IS
  'Métricas de vendas por mês para o módulo BI. '
  'Campos monetários (total_revenue, avg_ticket, prev_revenue, prev_avg_ticket) retornam NULL '
  'quando can_view_festa_values() = false. Frente Permissões de Valor v1.11.0.';

-- ─── 4. Patch em get_bi_unit_comparison ─────────────────────────────────────
-- Campos monetários mascarados: total_revenue, avg_ticket.
-- Campos não-monetários intocados: total_leads, won_leads, conversion_rate,
-- avg_closing_days, avg_booking_advance.

DROP FUNCTION IF EXISTS public.get_bi_unit_comparison(INTEGER);

CREATE OR REPLACE FUNCTION public.get_bi_unit_comparison(
  p_months INTEGER DEFAULT 7
)
RETURNS TABLE (
  unit_id              UUID,
  unit_name            TEXT,
  total_leads          BIGINT,
  won_leads            BIGINT,
  conversion_rate      NUMERIC,
  total_revenue        NUMERIC(14,2),
  avg_ticket           NUMERIC(12,2),
  avg_closing_days     NUMERIC(6,1),
  avg_booking_advance  NUMERIC(6,1)
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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
$$;

GRANT EXECUTE ON FUNCTION public.get_bi_unit_comparison(INTEGER) TO authenticated;

COMMENT ON FUNCTION public.get_bi_unit_comparison(INTEGER) IS
  'Comparativo de KPIs entre unidades para o módulo BI. '
  'Campos monetários (total_revenue, avg_ticket) retornam NULL '
  'quando can_view_festa_values() = false. Frente Permissões de Valor v1.11.0.';

-- ─── 5. Forçar reload do schema no PostgREST ────────────────────────────────

NOTIFY pgrst, 'reload schema';

COMMIT;
