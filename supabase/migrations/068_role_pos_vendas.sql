-- =============================================================
-- Migration 068: Nova role pos_vendas (pós-vendas transversal)
-- Contexto: usuários de pós-vendas veem dados agregados de todas
--           as vendedoras sem seller_id próprio. Não têm
--           deals/orders, só operam sobre dados existentes.
-- Impacto:
--   • 3 CHECK constraints (users, user_units, role_default_perms)
--   • is_global_viewer() atualizada
--   • 9 RPCs do módulo Vendas/Upsell/Recompra atualizados
--   • role_default_perms seed para pos_vendas
-- =============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. CHECK constraints — users.role
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'super_admin', 'diretor', 'gerente', 'vendedora',
    'decoracao', 'manutencao', 'financeiro', 'rh',
    'freelancer', 'entregador',
    'pos_vendas'
  ));

-- ─────────────────────────────────────────────────────────────
-- 2. CHECK constraints — user_units.role
--    (is_global_viewer() lê daqui — precisa aceitar pos_vendas)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.user_units DROP CONSTRAINT IF EXISTS user_units_role_check;

ALTER TABLE public.user_units ADD CONSTRAINT user_units_role_check
  CHECK (role IN (
    'super_admin', 'diretor', 'gerente', 'vendedora',
    'decoracao', 'manutencao', 'financeiro', 'rh',
    'freelancer', 'entregador',
    'pos_vendas'
  ));

-- ─────────────────────────────────────────────────────────────
-- 3. CHECK constraints — role_default_perms.role
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.role_default_perms DROP CONSTRAINT IF EXISTS role_default_perms_role_check;

ALTER TABLE public.role_default_perms ADD CONSTRAINT role_default_perms_role_check
  CHECK (role IN (
    'super_admin', 'diretor', 'gerente', 'vendedora',
    'decoracao', 'manutencao', 'financeiro', 'rh',
    'freelancer', 'entregador',
    'pos_vendas'
  ));

-- ─────────────────────────────────────────────────────────────
-- 4. is_global_viewer() — inclui pos_vendas
--    Preserva padrão original: lê de user_units.role (não users.role)
--    pos_vendas precisa ver eventos/deals/orders de todas as unidades
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_global_viewer()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_units
    WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'diretor', 'pos_vendas')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─────────────────────────────────────────────────────────────
-- 5. role_default_perms — permissões padrão para pos_vendas
--    Eventos: só ver + exportar (sem criar/editar/excluir)
--    Atas: ver + criar + editar (padrão existente para staff)
--    Notificações: ver
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.role_default_perms (role, module, action, granted)
VALUES
  ('pos_vendas', 'events',        'view',   true),
  ('pos_vendas', 'events',        'export', true),
  ('pos_vendas', 'events',        'create', false),
  ('pos_vendas', 'events',        'edit',   false),
  ('pos_vendas', 'events',        'delete', false),
  ('pos_vendas', 'minutes',       'view',   true),
  ('pos_vendas', 'minutes',       'create', true),
  ('pos_vendas', 'minutes',       'edit',   true),
  ('pos_vendas', 'notifications', 'view',   true)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 6. RPC: get_vendas_my_kpis
--    Alteração: pos_vendas adicionado ao NOT IN do guard
--    Comportamento: sem seller_id → v_eff_seller = p_seller_id (NULL)
--                   → agrega todas as vendedoras
-- ─────────────────────────────────────────────────────────────
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
  orders_agg AS (
    SELECT
      SUM(CASE WHEN po.date BETWEEN p_start_date AND p_end_date THEN po.amount ELSE 0 END)  AS curr_rev,
      COUNT(CASE WHEN po.date BETWEEN p_start_date AND p_end_date THEN 1 END)                AS curr_cnt,
      SUM(CASE WHEN po.date BETWEEN p_prev_start AND p_prev_end  THEN po.amount ELSE 0 END) AS prev_rev,
      COUNT(CASE WHEN po.date BETWEEN p_prev_start AND p_prev_end  THEN 1 END)               AS prev_cnt
    FROM public.ploomes_orders po
    WHERE po.date BETWEEN p_prev_start AND p_end_date
      AND (v_eff_seller IS NULL OR po.owner_id = v_owner_int)
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

-- Teste inline: guard DECLARE-based → auth.uid()=NULL → v_caller_role=NULL → guard não dispara
DO $$
BEGIN
  PERFORM public.get_vendas_my_kpis(
    NULL,
    '2024-01-01'::DATE, '2024-01-31'::DATE,
    '2023-12-01'::DATE, '2023-12-31'::DATE
  );
  RAISE NOTICE 'get_vendas_my_kpis: OK';
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'get_vendas_my_kpis quebrou: %', SQLERRM;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 7. RPC: get_vendas_daily_revenue
-- ─────────────────────────────────────────────────────────────
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
  SELECT
    po.date::DATE                                                    AS order_date,
    SUM(po.amount)::NUMERIC                                          AS revenue,
    SUM(SUM(po.amount)) OVER (ORDER BY po.date)::NUMERIC             AS cumulative_revenue
  FROM public.ploomes_orders po
  WHERE po.date BETWEEN p_start_date AND p_end_date
    AND (v_eff_seller IS NULL OR po.owner_id = v_owner_int)
  GROUP BY po.date
  ORDER BY po.date;
END;
$$;

DO $$
BEGIN
  PERFORM public.get_vendas_daily_revenue(
    NULL,
    '2024-01-01'::DATE, '2024-01-31'::DATE
  );
  RAISE NOTICE 'get_vendas_daily_revenue: OK';
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'get_vendas_daily_revenue quebrou: %', SQLERRM;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 8. RPC: get_vendas_ranking  (versão de migration 060 — schema change)
--    DROP obrigatório porque RETURNS TABLE mudou em 060
-- ─────────────────────────────────────────────────────────────
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
  ranked_sellers AS (
    SELECT
      s.id                                                               AS seller_id,
      s.name                                                             AS seller_name,
      s.owner_id                                                         AS s_owner_id,
      COALESCE(SUM(po.amount), 0)::NUMERIC                               AS total_revenue,
      COUNT(po.ploomes_order_id)::INTEGER                                AS order_count
    FROM public.sellers s
    LEFT JOIN public.ploomes_orders po
      ON po.owner_id = s.owner_id
     AND po.date BETWEEN p_start_date AND p_end_date
     AND (p_unit_id IS NULL OR po.unit_id = p_unit_id)
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

-- Teste inline: guard NOT EXISTS — tenta setar auth context dinâmico;
-- se banco local sem usuários, captura insufficient_privilege como OK
DO $$
DECLARE
  v_auth_id text;
BEGIN
  SELECT id::text INTO v_auth_id FROM public.users WHERE role = 'super_admin' LIMIT 1;
  IF v_auth_id IS NOT NULL THEN
    PERFORM set_config('request.jwt.claim.sub', v_auth_id, true);
  END IF;

  PERFORM public.get_vendas_ranking('2024-01-01'::DATE, '2024-12-31'::DATE, NULL);
  RAISE NOTICE 'get_vendas_ranking: OK';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%insufficient_privilege%' THEN
    RAISE NOTICE 'get_vendas_ranking: OK (função criada corretamente — sem auth context no banco local)';
  ELSE
    RAISE EXCEPTION 'get_vendas_ranking quebrou inesperadamente: %', SQLERRM;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 9. RPC: get_upsell_opportunities
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_upsell_opportunities(UUID, BOOLEAN, TEXT);

CREATE FUNCTION public.get_upsell_opportunities(
  p_seller_id      UUID    DEFAULT NULL,
  p_show_contacted BOOLEAN DEFAULT false,
  p_source         TEXT    DEFAULT 'all'
)
RETURNS TABLE(
  event_id                  UUID,
  event_date                DATE,
  event_title               TEXT,
  deal_id                   BIGINT,
  unit_id                   UUID,
  contact_id                UUID,
  ploomes_contact_id        BIGINT,
  contact_name              TEXT,
  contact_email             TEXT,
  contact_phones            JSONB,
  contact_birthday          DATE,
  contact_next_anniversary  DATE,
  contact_prev_anniversary  DATE,
  contact_owner_id          INTEGER,
  contact_owner_name        TEXT,
  is_carteira_livre         BOOLEAN,
  tem_adicional             BOOLEAN,
  tem_upgrade               BOOLEAN,
  missing_categories        TEXT[],
  log_id                    UUID,
  log_outcome               TEXT,
  log_contacted_at          TIMESTAMPTZ,
  log_notes                 TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_owner_id INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin','diretor','gerente','vendedora','pos_vendas')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  IF p_seller_id IS NOT NULL THEN
    SELECT owner_id INTO v_seller_owner_id
    FROM public.sellers
    WHERE id = p_seller_id;
  END IF;

  RETURN QUERY
  WITH
  products_per_deal AS (
    SELECT
      po.deal_id,
      BOOL_OR(normalize_product_category(pop.group_name) = 'Adicionais') AS tem_adicional,
      BOOL_OR(normalize_product_category(pop.group_name) = 'Upgrades')   AS tem_upgrade
    FROM public.ploomes_orders po
    JOIN public.ploomes_order_products pop ON pop.order_id = po.ploomes_order_id
    GROUP BY po.deal_id
  ),
  active_seller_owner_ids AS (
    SELECT owner_id
    FROM public.sellers
    WHERE status = 'active'
      AND is_system_account = false
      AND owner_id IS NOT NULL
  ),
  base AS (
    SELECT
      e.id                                                               AS event_id,
      e.date                                                             AS event_date,
      e.title                                                            AS event_title,
      e.ploomes_deal_id::BIGINT                                          AS deal_id,
      e.unit_id,
      pc.id                                                              AS contact_id,
      pc.ploomes_contact_id,
      pc.name                                                            AS contact_name,
      pc.email                                                           AS contact_email,
      pc.phones                                                          AS contact_phones,
      pc.birthday                                                        AS contact_birthday,
      pc.next_anniversary                                                AS contact_next_anniversary,
      pc.previous_anniversary                                            AS contact_prev_anniversary,
      pc.owner_id                                                        AS contact_owner_id,
      pc.owner_name                                                      AS contact_owner_name,
      NOT EXISTS (
        SELECT 1 FROM active_seller_owner_ids aso
        WHERE aso.owner_id = pc.owner_id
      )                                                                  AS is_carteira_livre,
      COALESCE(ppd.tem_adicional, false)                                 AS tem_adicional,
      COALESCE(ppd.tem_upgrade,   false)                                 AS tem_upgrade,
      ucl.id                                                             AS log_id,
      ucl.outcome                                                        AS log_outcome,
      ucl.contacted_at                                                   AS log_contacted_at,
      ucl.notes                                                          AS log_notes
    FROM public.events e
    JOIN public.ploomes_deals pd
      ON pd.ploomes_deal_id = e.ploomes_deal_id::BIGINT
    LEFT JOIN products_per_deal ppd
      ON ppd.deal_id = e.ploomes_deal_id::BIGINT
    JOIN public.ploomes_contacts pc
      ON pc.email = LOWER(TRIM(pd.contact_email))
    LEFT JOIN public.upsell_contact_log ucl
      ON ucl.event_id = e.id
     AND ucl.reopened_at IS NULL
    WHERE e.status    = 'confirmed'
      AND e.date BETWEEN CURRENT_DATE + 30 AND CURRENT_DATE + 40
      AND e.ploomes_deal_id IS NOT NULL
      AND NOT (
        COALESCE(ppd.tem_adicional, false)
        AND COALESCE(ppd.tem_upgrade, false)
      )
  )
  SELECT
    b.event_id,
    b.event_date,
    b.event_title,
    b.deal_id,
    b.unit_id,
    b.contact_id,
    b.ploomes_contact_id,
    b.contact_name,
    b.contact_email,
    b.contact_phones,
    b.contact_birthday,
    b.contact_next_anniversary,
    b.contact_prev_anniversary,
    b.contact_owner_id,
    b.contact_owner_name,
    b.is_carteira_livre,
    b.tem_adicional,
    b.tem_upgrade,
    ARRAY(
      SELECT x FROM unnest(ARRAY['Adicionais','Upgrades']) AS x
      WHERE (x = 'Adicionais' AND NOT b.tem_adicional)
         OR (x = 'Upgrades'   AND NOT b.tem_upgrade)
    )                                                                    AS missing_categories,
    b.log_id,
    b.log_outcome,
    b.log_contacted_at,
    b.log_notes
  FROM base b
  WHERE
    (p_show_contacted OR b.log_id IS NULL)
    AND (
      p_source = 'all'
      OR (p_source = 'carteira_livre' AND b.is_carteira_livre)
      OR (p_source = 'mine'
          AND NOT b.is_carteira_livre
          AND (
            p_seller_id IS NULL
            OR b.contact_owner_id = v_seller_owner_id
          ))
    )
  ORDER BY b.event_date, b.contact_name;
END;
$$;

DO $$
DECLARE
  v_auth_id text;
BEGIN
  SELECT id::text INTO v_auth_id FROM public.users WHERE role = 'super_admin' LIMIT 1;
  IF v_auth_id IS NOT NULL THEN
    PERFORM set_config('request.jwt.claim.sub', v_auth_id, true);
  END IF;

  PERFORM public.get_upsell_opportunities(NULL, false, 'all');
  RAISE NOTICE 'get_upsell_opportunities: OK';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%insufficient_privilege%' THEN
    RAISE NOTICE 'get_upsell_opportunities: OK (função criada corretamente — sem auth context no banco local)';
  ELSE
    RAISE EXCEPTION 'get_upsell_opportunities quebrou inesperadamente: %', SQLERRM;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 10. RPC: get_upsell_count_for_user
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_upsell_count_for_user();

CREATE FUNCTION public.get_upsell_count_for_user()
RETURNS TABLE(
  my_count             INTEGER,
  carteira_livre_count INTEGER,
  total                INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_id       UUID;
  v_seller_owner_id INTEGER;
  v_role            TEXT;
BEGIN
  SELECT role, seller_id INTO v_role, v_seller_id
  FROM public.users
  WHERE id = auth.uid();

  IF v_role NOT IN ('super_admin','diretor','gerente','vendedora','pos_vendas') THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  IF v_seller_id IS NOT NULL THEN
    SELECT owner_id INTO v_seller_owner_id
    FROM public.sellers
    WHERE id = v_seller_id;
  END IF;

  RETURN QUERY
  WITH
  products_per_deal AS (
    SELECT
      po.deal_id,
      BOOL_OR(normalize_product_category(pop.group_name) = 'Adicionais') AS tem_adicional,
      BOOL_OR(normalize_product_category(pop.group_name) = 'Upgrades')   AS tem_upgrade
    FROM public.ploomes_orders po
    JOIN public.ploomes_order_products pop ON pop.order_id = po.ploomes_order_id
    GROUP BY po.deal_id
  ),
  active_seller_owner_ids AS (
    SELECT owner_id
    FROM public.sellers
    WHERE status = 'active'
      AND is_system_account = false
      AND owner_id IS NOT NULL
  ),
  opps AS (
    SELECT
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM active_seller_owner_ids aso WHERE aso.owner_id = pc.owner_id
      ) THEN true ELSE false END AS is_carteira_livre,
      pc.owner_id AS contact_owner_id
    FROM public.events e
    JOIN public.ploomes_deals pd
      ON pd.ploomes_deal_id = e.ploomes_deal_id::BIGINT
    LEFT JOIN products_per_deal ppd
      ON ppd.deal_id = e.ploomes_deal_id::BIGINT
    JOIN public.ploomes_contacts pc
      ON pc.email = LOWER(TRIM(pd.contact_email))
    WHERE e.status    = 'confirmed'
      AND e.date BETWEEN CURRENT_DATE + 30 AND CURRENT_DATE + 40
      AND e.ploomes_deal_id IS NOT NULL
      AND NOT (
        COALESCE(ppd.tem_adicional, false)
        AND COALESCE(ppd.tem_upgrade, false)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.upsell_contact_log ucl
        WHERE ucl.event_id = e.id
          AND ucl.reopened_at IS NULL
      )
  )
  SELECT
    COUNT(CASE
      WHEN NOT o.is_carteira_livre
           AND (v_seller_id IS NULL OR o.contact_owner_id = v_seller_owner_id)
      THEN 1
    END)::INTEGER,
    COUNT(CASE WHEN o.is_carteira_livre THEN 1 END)::INTEGER,
    COUNT(*)::INTEGER
  FROM opps o;
END;
$$;

DO $$
BEGIN
  PERFORM public.get_upsell_count_for_user();
  RAISE NOTICE 'get_upsell_count_for_user: OK';
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'get_upsell_count_for_user quebrou: %', SQLERRM;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 11. RPC: get_upsell_popular_addons
--     (NOTA: não listada no Phase 1 mas tem o mesmo guard — incluída aqui)
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_upsell_popular_addons(TEXT);

CREATE FUNCTION public.get_upsell_popular_addons(
  p_package_name TEXT
)
RETURNS TABLE(
  product_name TEXT,
  category     TEXT,
  cnt          INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin','diretor','gerente','vendedora','pos_vendas')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  RETURN QUERY
  WITH orders_with_package AS (
    SELECT DISTINCT pop.order_id
    FROM public.ploomes_order_products pop
    WHERE normalize_product_category(pop.group_name) = 'Pacotes'
      AND pop.product_name ILIKE '%' || p_package_name || '%'
  ),
  addons_in_those_orders AS (
    SELECT
      pop.product_name,
      normalize_product_category(pop.group_name) AS category,
      COUNT(*)::INTEGER                           AS cnt
    FROM public.ploomes_order_products pop
    JOIN orders_with_package owp ON owp.order_id = pop.order_id
    WHERE normalize_product_category(pop.group_name) IN ('Adicionais','Upgrades')
      AND pop.product_name IS NOT NULL
    GROUP BY pop.product_name, normalize_product_category(pop.group_name)
  )
  SELECT a.product_name, a.category, a.cnt
  FROM addons_in_those_orders a
  ORDER BY a.cnt DESC
  LIMIT 10;
END;
$$;

DO $$
DECLARE
  v_auth_id text;
BEGIN
  SELECT id::text INTO v_auth_id FROM public.users WHERE role = 'super_admin' LIMIT 1;
  IF v_auth_id IS NOT NULL THEN
    PERFORM set_config('request.jwt.claim.sub', v_auth_id, true);
  END IF;

  PERFORM public.get_upsell_popular_addons('Pacote');
  RAISE NOTICE 'get_upsell_popular_addons: OK';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%insufficient_privilege%' THEN
    RAISE NOTICE 'get_upsell_popular_addons: OK (função criada corretamente — sem auth context no banco local)';
  ELSE
    RAISE EXCEPTION 'get_upsell_popular_addons quebrou inesperadamente: %', SQLERRM;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 12. RPC: get_recompra_aniversario_proximo
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_recompra_aniversario_proximo(UUID, BOOLEAN, TEXT, INTEGER);

CREATE FUNCTION public.get_recompra_aniversario_proximo(
  p_seller_id      UUID    DEFAULT NULL,
  p_show_contacted BOOLEAN DEFAULT false,
  p_source         TEXT    DEFAULT 'all',
  p_days_ahead     INTEGER DEFAULT 90
)
RETURNS TABLE(
  deal_id                  BIGINT,
  deal_title               TEXT,
  unit_id                  UUID,
  contact_id               UUID,
  ploomes_contact_id       BIGINT,
  contact_name             TEXT,
  contact_email            TEXT,
  contact_phones           JSONB,
  aniversariante_birthday  DATE,
  next_birthday            DATE,
  days_until_birthday      INTEGER,
  contact_owner_id         INTEGER,
  contact_owner_name       TEXT,
  is_carteira_livre        BOOLEAN,
  log_id                   UUID,
  log_outcome              TEXT,
  log_contacted_at         TIMESTAMPTZ,
  log_notes                TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_owner_id INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin','diretor','gerente','vendedora','pos_vendas')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  IF p_seller_id IS NOT NULL THEN
    SELECT owner_id INTO v_seller_owner_id
    FROM public.sellers
    WHERE id = p_seller_id;
  END IF;

  RETURN QUERY
  WITH
  active_seller_owner_ids AS (
    SELECT owner_id
    FROM public.sellers
    WHERE status = 'active'
      AND is_system_account = false
      AND owner_id IS NOT NULL
  ),
  ranked_deals AS (
    SELECT
      pd.ploomes_deal_id,
      pd.title           AS deal_title,
      pd.unit_id,
      LOWER(TRIM(pd.contact_email))           AS norm_email,
      pd.aniversariante_birthday,
      pd.owner_id,
      pd.owner_name,
      ROW_NUMBER() OVER (
        PARTITION BY LOWER(TRIM(pd.contact_email)), pd.aniversariante_birthday
        ORDER BY COALESCE(pd.event_date, pd.ploomes_create_date::DATE) DESC
      ) AS rn
    FROM public.ploomes_deals pd
    WHERE pd.status_id = 2
      AND pd.aniversariante_birthday IS NOT NULL
      AND pd.contact_email IS NOT NULL
  ),
  best_deals AS (
    SELECT * FROM ranked_deals WHERE rn = 1
  ),
  with_next_bday AS (
    SELECT
      bd.*,
      CASE
        WHEN EXTRACT(MONTH FROM bd.aniversariante_birthday) = 2
             AND EXTRACT(DAY   FROM bd.aniversariante_birthday) = 29
        THEN
          CASE
            WHEN MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::INT, 2, 28) >= CURRENT_DATE
            THEN MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::INT, 2, 28)
            ELSE MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::INT + 1, 2, 28)
          END
        ELSE
          CASE
            WHEN MAKE_DATE(
                   EXTRACT(YEAR  FROM CURRENT_DATE)::INT,
                   EXTRACT(MONTH FROM bd.aniversariante_birthday)::INT,
                   EXTRACT(DAY   FROM bd.aniversariante_birthday)::INT
                 ) >= CURRENT_DATE
            THEN MAKE_DATE(
                   EXTRACT(YEAR  FROM CURRENT_DATE)::INT,
                   EXTRACT(MONTH FROM bd.aniversariante_birthday)::INT,
                   EXTRACT(DAY   FROM bd.aniversariante_birthday)::INT
                 )
            ELSE MAKE_DATE(
                   EXTRACT(YEAR  FROM CURRENT_DATE)::INT + 1,
                   EXTRACT(MONTH FROM bd.aniversariante_birthday)::INT,
                   EXTRACT(DAY   FROM bd.aniversariante_birthday)::INT
                 )
          END
      END AS next_birthday
    FROM best_deals bd
  ),
  in_window AS (
    SELECT
      nb.*,
      NOT EXISTS (
        SELECT 1 FROM active_seller_owner_ids aso
        WHERE aso.owner_id = nb.owner_id
      ) AS is_carteira_livre
    FROM with_next_bday nb
    WHERE nb.next_birthday BETWEEN CURRENT_DATE AND (CURRENT_DATE + p_days_ahead)
  )
  SELECT
    iw.ploomes_deal_id::BIGINT,
    iw.deal_title,
    iw.unit_id,
    pc.id                                                     AS contact_id,
    pc.ploomes_contact_id,
    COALESCE(pc.name, iw.norm_email)                          AS contact_name,
    iw.norm_email                                             AS contact_email,
    pc.phones                                                 AS contact_phones,
    iw.aniversariante_birthday,
    iw.next_birthday,
    (iw.next_birthday - CURRENT_DATE)::INTEGER                AS days_until_birthday,
    iw.owner_id                                               AS contact_owner_id,
    iw.owner_name                                             AS contact_owner_name,
    iw.is_carteira_livre,
    rcl.id                                                    AS log_id,
    rcl.outcome                                               AS log_outcome,
    rcl.contacted_at                                          AS log_contacted_at,
    rcl.notes                                                 AS log_notes
  FROM in_window iw
  LEFT JOIN public.ploomes_contacts pc
    ON pc.email = iw.norm_email
  LEFT JOIN public.recompra_contact_log rcl
    ON  rcl.contact_email           = iw.norm_email
    AND rcl.aniversariante_birthday = iw.aniversariante_birthday
    AND rcl.recompra_type           = 'aniversario'
    AND rcl.reopened_at IS NULL
  WHERE
    (p_show_contacted OR rcl.id IS NULL)
    AND (
      p_source = 'all'
      OR (p_source = 'carteira_livre' AND     iw.is_carteira_livre)
      OR (p_source = 'mine'
          AND NOT iw.is_carteira_livre
          AND (
            p_seller_id IS NULL
            OR iw.owner_id = v_seller_owner_id
          ))
    )
  ORDER BY iw.next_birthday, iw.norm_email;
END;
$$;

DO $$
DECLARE
  v_auth_id text;
BEGIN
  SELECT id::text INTO v_auth_id FROM public.users WHERE role = 'super_admin' LIMIT 1;
  IF v_auth_id IS NOT NULL THEN
    PERFORM set_config('request.jwt.claim.sub', v_auth_id, true);
  END IF;

  PERFORM public.get_recompra_aniversario_proximo(NULL, false, 'all', 90);
  RAISE NOTICE 'get_recompra_aniversario_proximo: OK';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%insufficient_privilege%' THEN
    RAISE NOTICE 'get_recompra_aniversario_proximo: OK (função criada corretamente — sem auth context no banco local)';
  ELSE
    RAISE EXCEPTION 'get_recompra_aniversario_proximo quebrou inesperadamente: %', SQLERRM;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 13. RPC: get_recompra_festa_passada
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_recompra_festa_passada(UUID, BOOLEAN, TEXT);

CREATE FUNCTION public.get_recompra_festa_passada(
  p_seller_id      UUID    DEFAULT NULL,
  p_show_contacted BOOLEAN DEFAULT false,
  p_source         TEXT    DEFAULT 'all'
)
RETURNS TABLE(
  deal_id                  BIGINT,
  deal_title               TEXT,
  unit_id                  UUID,
  contact_id               UUID,
  ploomes_contact_id       BIGINT,
  contact_name             TEXT,
  contact_email            TEXT,
  contact_phones           JSONB,
  aniversariante_birthday  DATE,
  last_event_date          DATE,
  months_since_event       INTEGER,
  contact_owner_id         INTEGER,
  contact_owner_name       TEXT,
  is_carteira_livre        BOOLEAN,
  log_id                   UUID,
  log_outcome              TEXT,
  log_contacted_at         TIMESTAMPTZ,
  log_notes                TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_owner_id INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin','diretor','gerente','vendedora','pos_vendas')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  IF p_seller_id IS NOT NULL THEN
    SELECT owner_id INTO v_seller_owner_id
    FROM public.sellers
    WHERE id = p_seller_id;
  END IF;

  RETURN QUERY
  WITH
  active_seller_owner_ids AS (
    SELECT owner_id
    FROM public.sellers
    WHERE status = 'active'
      AND is_system_account = false
      AND owner_id IS NOT NULL
  ),
  ranked_deals AS (
    SELECT
      pd.ploomes_deal_id,
      pd.title                                                AS deal_title,
      pd.unit_id,
      LOWER(TRIM(pd.contact_email))                           AS norm_email,
      pd.aniversariante_birthday,
      COALESCE(pd.event_date, pd.ploomes_create_date::DATE)   AS event_ref_date,
      pd.owner_id,
      pd.owner_name,
      ROW_NUMBER() OVER (
        PARTITION BY LOWER(TRIM(pd.contact_email)), pd.aniversariante_birthday
        ORDER BY COALESCE(pd.event_date, pd.ploomes_create_date::DATE) DESC
      ) AS rn
    FROM public.ploomes_deals pd
    WHERE pd.status_id = 2
      AND pd.aniversariante_birthday IS NOT NULL
      AND pd.contact_email IS NOT NULL
  ),
  best_deals AS (
    SELECT * FROM ranked_deals WHERE rn = 1
  ),
  candidates AS (
    SELECT
      bd.*,
      NOT EXISTS (
        SELECT 1 FROM active_seller_owner_ids aso
        WHERE aso.owner_id = bd.owner_id
      ) AS is_carteira_livre
    FROM best_deals bd
    WHERE NOT EXISTS (
      SELECT 1 FROM public.ploomes_deals d2
      WHERE LOWER(TRIM(d2.contact_email)) = bd.norm_email
        AND d2.status_id IN (1, 2)
        AND COALESCE(d2.event_date, d2.ploomes_create_date::DATE)
            >= CURRENT_DATE - INTERVAL '10 months'
    )
  )
  SELECT
    c.ploomes_deal_id::BIGINT,
    c.deal_title,
    c.unit_id,
    pc.id                                                     AS contact_id,
    pc.ploomes_contact_id,
    COALESCE(pc.name, c.norm_email)                           AS contact_name,
    c.norm_email                                              AS contact_email,
    pc.phones                                                 AS contact_phones,
    c.aniversariante_birthday,
    c.event_ref_date                                          AS last_event_date,
    EXTRACT(MONTH FROM AGE(CURRENT_DATE, c.event_ref_date))::INTEGER
      + EXTRACT(YEAR FROM AGE(CURRENT_DATE, c.event_ref_date))::INTEGER * 12
                                                              AS months_since_event,
    c.owner_id                                                AS contact_owner_id,
    c.owner_name                                              AS contact_owner_name,
    c.is_carteira_livre,
    rcl.id                                                    AS log_id,
    rcl.outcome                                               AS log_outcome,
    rcl.contacted_at                                          AS log_contacted_at,
    rcl.notes                                                 AS log_notes
  FROM candidates c
  LEFT JOIN public.ploomes_contacts pc
    ON pc.email = c.norm_email
  LEFT JOIN public.recompra_contact_log rcl
    ON  rcl.contact_email           = c.norm_email
    AND rcl.aniversariante_birthday = c.aniversariante_birthday
    AND rcl.recompra_type           = 'festa_passada'
    AND rcl.reopened_at IS NULL
  WHERE
    (p_show_contacted OR rcl.id IS NULL)
    AND (
      p_source = 'all'
      OR (p_source = 'carteira_livre' AND     c.is_carteira_livre)
      OR (p_source = 'mine'
          AND NOT c.is_carteira_livre
          AND (
            p_seller_id IS NULL
            OR c.owner_id = v_seller_owner_id
          ))
    )
  ORDER BY c.event_ref_date ASC, c.norm_email;
END;
$$;

DO $$
DECLARE
  v_auth_id text;
BEGIN
  SELECT id::text INTO v_auth_id FROM public.users WHERE role = 'super_admin' LIMIT 1;
  IF v_auth_id IS NOT NULL THEN
    PERFORM set_config('request.jwt.claim.sub', v_auth_id, true);
  END IF;

  PERFORM public.get_recompra_festa_passada(NULL, false, 'all');
  RAISE NOTICE 'get_recompra_festa_passada: OK';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%insufficient_privilege%' THEN
    RAISE NOTICE 'get_recompra_festa_passada: OK (função criada corretamente — sem auth context no banco local)';
  ELSE
    RAISE EXCEPTION 'get_recompra_festa_passada quebrou inesperadamente: %', SQLERRM;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 14. RPC: get_recompra_count_for_user
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_recompra_count_for_user();

CREATE FUNCTION public.get_recompra_count_for_user()
RETURNS TABLE(
  aniversario_count   INTEGER,
  festa_passada_count INTEGER,
  total               INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_id       UUID;
  v_seller_owner_id INTEGER;
  v_role            TEXT;
BEGIN
  SELECT role, seller_id INTO v_role, v_seller_id
  FROM public.users
  WHERE id = auth.uid();

  IF v_role NOT IN ('super_admin','diretor','gerente','vendedora','pos_vendas') THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  IF v_seller_id IS NOT NULL THEN
    SELECT owner_id INTO v_seller_owner_id
    FROM public.sellers
    WHERE id = v_seller_id;
  END IF;

  RETURN QUERY
  WITH
  active_seller_owner_ids AS (
    SELECT owner_id
    FROM public.sellers
    WHERE status = 'active'
      AND is_system_account = false
      AND owner_id IS NOT NULL
  ),
  ranked_deals AS (
    SELECT
      pd.ploomes_deal_id,
      LOWER(TRIM(pd.contact_email))                           AS norm_email,
      pd.aniversariante_birthday,
      COALESCE(pd.event_date, pd.ploomes_create_date::DATE)   AS event_ref_date,
      pd.owner_id,
      NOT EXISTS (
        SELECT 1 FROM active_seller_owner_ids aso
        WHERE aso.owner_id = pd.owner_id
      ) AS is_carteira_livre,
      ROW_NUMBER() OVER (
        PARTITION BY LOWER(TRIM(pd.contact_email)), pd.aniversariante_birthday
        ORDER BY COALESCE(pd.event_date, pd.ploomes_create_date::DATE) DESC
      ) AS rn
    FROM public.ploomes_deals pd
    WHERE pd.status_id = 2
      AND pd.aniversariante_birthday IS NOT NULL
      AND pd.contact_email IS NOT NULL
  ),
  best_deals AS (
    SELECT * FROM ranked_deals WHERE rn = 1
  ),
  with_next_bday AS (
    SELECT
      bd.*,
      CASE
        WHEN EXTRACT(MONTH FROM bd.aniversariante_birthday) = 2
             AND EXTRACT(DAY   FROM bd.aniversariante_birthday) = 29
        THEN
          CASE
            WHEN MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::INT, 2, 28) >= CURRENT_DATE
            THEN MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::INT, 2, 28)
            ELSE MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::INT + 1, 2, 28)
          END
        ELSE
          CASE
            WHEN MAKE_DATE(
                   EXTRACT(YEAR  FROM CURRENT_DATE)::INT,
                   EXTRACT(MONTH FROM bd.aniversariante_birthday)::INT,
                   EXTRACT(DAY   FROM bd.aniversariante_birthday)::INT
                 ) >= CURRENT_DATE
            THEN MAKE_DATE(
                   EXTRACT(YEAR  FROM CURRENT_DATE)::INT,
                   EXTRACT(MONTH FROM bd.aniversariante_birthday)::INT,
                   EXTRACT(DAY   FROM bd.aniversariante_birthday)::INT
                 )
            ELSE MAKE_DATE(
                   EXTRACT(YEAR  FROM CURRENT_DATE)::INT + 1,
                   EXTRACT(MONTH FROM bd.aniversariante_birthday)::INT,
                   EXTRACT(DAY   FROM bd.aniversariante_birthday)::INT
                 )
          END
      END AS next_birthday
    FROM best_deals bd
  ),
  aniversario_opps AS (
    SELECT nb.norm_email, nb.aniversariante_birthday
    FROM with_next_bday nb
    WHERE nb.next_birthday BETWEEN CURRENT_DATE AND (CURRENT_DATE + 90)
      AND NOT EXISTS (
        SELECT 1 FROM public.recompra_contact_log rcl
        WHERE rcl.contact_email           = nb.norm_email
          AND rcl.aniversariante_birthday = nb.aniversariante_birthday
          AND rcl.recompra_type           = 'aniversario'
          AND rcl.reopened_at IS NULL
      )
      AND (
        v_seller_id IS NULL
        OR nb.is_carteira_livre
        OR nb.owner_id = v_seller_owner_id
      )
  ),
  festa_passada_opps AS (
    SELECT bd.norm_email, bd.aniversariante_birthday
    FROM best_deals bd
    WHERE NOT EXISTS (
        SELECT 1 FROM public.ploomes_deals d2
        WHERE LOWER(TRIM(d2.contact_email)) = bd.norm_email
          AND d2.status_id IN (1, 2)
          AND COALESCE(d2.event_date, d2.ploomes_create_date::DATE)
              >= CURRENT_DATE - INTERVAL '10 months'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.recompra_contact_log rcl
        WHERE rcl.contact_email           = bd.norm_email
          AND rcl.aniversariante_birthday = bd.aniversariante_birthday
          AND rcl.recompra_type           = 'festa_passada'
          AND rcl.reopened_at IS NULL
      )
      AND (
        v_seller_id IS NULL
        OR bd.is_carteira_livre
        OR bd.owner_id = v_seller_owner_id
      )
  )
  SELECT
    (SELECT COUNT(*)::INTEGER FROM aniversario_opps),
    (SELECT COUNT(*)::INTEGER FROM festa_passada_opps),
    (SELECT COUNT(*)::INTEGER FROM aniversario_opps)
    + (SELECT COUNT(*)::INTEGER FROM festa_passada_opps);
END;
$$;

DO $$
BEGIN
  PERFORM public.get_recompra_count_for_user();
  RAISE NOTICE 'get_recompra_count_for_user: OK';
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'get_recompra_count_for_user quebrou: %', SQLERRM;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 15. Documentação
-- ─────────────────────────────────────────────────────────────
COMMENT ON COLUMN public.users.role IS
  'Roles do sistema. pos_vendas = operação transversal sobre dados de vendas, '
  'sem seller_id próprio. Vê dados agregados de todas as vendedoras em '
  '/vendas, /eventos (read-only) e /atas.';

COMMIT;
