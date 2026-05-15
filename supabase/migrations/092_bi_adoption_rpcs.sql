-- Migration 092: RPCs de adoção de "Convidados Contratados" para o BI
-- Mede o % de orders com contracted_guests preenchido no período selecionado.

-- ─── get_bi_adoption_kpi ───────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_bi_adoption_kpi(DATE, DATE, UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION public.get_bi_adoption_kpi(
  p_start_date      DATE,
  p_end_date        DATE,
  p_unit_id         UUID    DEFAULT NULL,
  p_include_inactive BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  total_orders        BIGINT,
  orders_preenchidas  BIGINT,
  percentual_adocao   NUMERIC
)
LANGUAGE plpgsql
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
$$;

-- ─── get_bi_adoption_ranking ──────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_bi_adoption_ranking(DATE, DATE, UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION public.get_bi_adoption_ranking(
  p_start_date       DATE,
  p_end_date         DATE,
  p_unit_id          UUID    DEFAULT NULL,
  p_include_inactive BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  seller_id          INTEGER,
  seller_name        TEXT,
  seller_status      TEXT,
  is_system_account  BOOLEAN,
  total_orders       BIGINT,
  orders_preenchidas BIGINT,
  percentual_adocao  NUMERIC
)
LANGUAGE plpgsql
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
$$;

NOTIFY pgrst, 'reload schema';
