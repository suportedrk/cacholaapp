-- ============================================================
-- Migration 123 — Vendas: conversão dos guards para check_permission (Fase 3, Parte 2)
-- Criado em: 2026-05-29
-- Referência: docs/rbac/fase-a-vendas.md + Receita Passos 3-6 (cachola-rbac-pattern)
--             + helper check_permission_or_raise (migration 120)
--             + backfill aplicado na migration 122 (Parte 1, já em produção)
--
-- Converte 10 RPCs SECURITY DEFINER do guard por CARGO (role IN inline)
-- para o guard configurável check_permission_or_raise(modulo, 'view').
-- Os corpos das funções foram extraídos via pg_get_functiondef do banco
-- de PRODUÇÃO (estado vivo) e preservados byte-a-byte; SOMENTE o bloco
-- de guarda foi substituído. Onde role/seller_id é lido para LÓGICA de
-- escopo (ex.: vendedora força próprio seller), o SELECT foi mantido —
-- só o uso do role como PORTÃO foi removido.
--
-- ── DECISÕES DO DONO ──────────────────────────────────────────
--   G-i:    9 RPCs de leitura  → check_permission_or_raise('vendas','view')
--   G-RISK: get_event_sales_summary → check_permission_or_raise('eventos','view')
--           (consumido em /eventos/[id]; preserva gerente — opção C).
--           CORREÇÃO: o código do módulo no catálogo é 'eventos' (PT-BR,
--           migration 073), NÃO 'events'. Usar 'events' bloquearia todos
--           menos super_admin. Verificado em permission_controls.
--   G-ii:   RPCs/RLS de escrita-log permanecem por cargo (NÃO tocados).
--   G-iii:  lógica D3 (isVendedora/isManager/agregação) permanece (NÃO tocada).
--
-- ── LIMPEZA DE OVERRIDE DORMENTE (opção A) ────────────────────
--   Remove grants de 'vendas' de usuários cujo role está FORA de
--   (super_admin, diretor, vendedora, pos_vendas). Pela auditoria de
--   produção (2026-05-29) isso atinge só o gerente brunocasaletti@gmail.com
--   (5 grants). super_admin e os 3 cargos backfillados NÃO são tocados.
--
-- Pré-condição: migrations 120 (helper) e 122 (backfill) aplicadas.
-- Tudo em uma transação.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Pré-condição: catálogo tem vendas.view e eventos.view
-- ------------------------------------------------------------
DO $precond$
DECLARE
  v_vendas  INT;
  v_eventos INT;
BEGIN
  SELECT COUNT(*) INTO v_vendas  FROM public.permission_controls
    WHERE module_code='vendas'  AND code='view' AND kind='action';
  SELECT COUNT(*) INTO v_eventos FROM public.permission_controls
    WHERE module_code='eventos' AND code='view' AND kind='action';
  IF v_vendas <> 1 OR v_eventos <> 1 THEN
    RAISE EXCEPTION 'Abortando: faltam ações no catálogo (vendas.view=%, eventos.view=%). Migration 107 precisa estar aplicada.', v_vendas, v_eventos;
  END IF;
END
$precond$;

-- ------------------------------------------------------------
-- PARTE 1a — Limpeza de overrides dormentes de 'vendas' (opção A)
-- ------------------------------------------------------------
DO $cleanup$
DECLARE
  v_before INT;
  v_after  INT;
BEGIN
  SELECT COUNT(*) INTO v_before
  FROM public.user_permissions up
  JOIN public.users u ON u.id = up.user_id
  WHERE up.module = 'vendas'
    AND u.role NOT IN ('super_admin','diretor','vendedora','pos_vendas');
  RAISE NOTICE 'overrides vendas (cargos fora do guard) ANTES: %', v_before;

  DELETE FROM public.user_permissions up
  USING public.users u
  WHERE up.user_id = u.id
    AND up.module  = 'vendas'
    AND u.role NOT IN ('super_admin','diretor','vendedora','pos_vendas');

  SELECT COUNT(*) INTO v_after
  FROM public.user_permissions up
  JOIN public.users u ON u.id = up.user_id
  WHERE up.module = 'vendas'
    AND u.role NOT IN ('super_admin','diretor','vendedora','pos_vendas');
  RAISE NOTICE 'overrides vendas (cargos fora do guard) DEPOIS: % (removidos: %)', v_after, v_before - v_after;
END
$cleanup$;

-- ============================================================
-- PARTE 1b/1c — Conversão dos 10 RPCs (corpo preservado, só guarda trocada)
-- ============================================================

-- ---------- get_vendas_my_kpis ----------
CREATE OR REPLACE FUNCTION public.get_vendas_my_kpis(p_seller_id uuid, p_start_date date, p_end_date date, p_prev_start date, p_prev_end date)
 RETURNS TABLE(total_revenue numeric, order_count integer, avg_ticket numeric, won_count integer, conversion_rate numeric, prev_revenue numeric, prev_order_count integer, prev_avg_ticket numeric, prev_won_count integer, prev_conversion_rate numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  PERFORM public.check_permission_or_raise('vendas', 'view');

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
  order_prods AS (
    SELECT
      po.ploomes_order_id,
      po.date,
      po.owner_id,
      COALESCE(SUM(pop.total), 0) AS soma_prod
    FROM public.ploomes_orders po
    LEFT JOIN public.ploomes_order_products pop ON pop.order_id = po.ploomes_order_id
    WHERE po.date BETWEEN p_prev_start AND p_end_date
      AND (v_eff_seller IS NULL OR po.owner_id = v_owner_int)
    GROUP BY po.ploomes_order_id, po.date, po.owner_id
  ),
  orders_agg AS (
    SELECT
      SUM(CASE WHEN op.date BETWEEN p_start_date AND p_end_date THEN op.soma_prod ELSE 0 END)  AS curr_rev,
      COUNT(CASE WHEN op.date BETWEEN p_start_date AND p_end_date THEN 1 END)                   AS curr_cnt,
      SUM(CASE WHEN op.date BETWEEN p_prev_start AND p_prev_end  THEN op.soma_prod ELSE 0 END) AS prev_rev,
      COUNT(CASE WHEN op.date BETWEEN p_prev_start AND p_prev_end  THEN 1 END)                  AS prev_cnt
    FROM order_prods op
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
$function$

;

-- ---------- get_vendas_daily_revenue ----------
CREATE OR REPLACE FUNCTION public.get_vendas_daily_revenue(p_seller_id uuid, p_start_date date, p_end_date date)
 RETURNS TABLE(order_date date, revenue numeric, cumulative_revenue numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  PERFORM public.check_permission_or_raise('vendas', 'view');

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
  WITH order_prods AS (
    SELECT
      po.date,
      COALESCE(SUM(pop.total), 0) AS soma_prod
    FROM public.ploomes_orders po
    LEFT JOIN public.ploomes_order_products pop ON pop.order_id = po.ploomes_order_id
    WHERE po.date BETWEEN p_start_date AND p_end_date
      AND (v_eff_seller IS NULL OR po.owner_id = v_owner_int)
    GROUP BY po.ploomes_order_id, po.date
  )
  SELECT
    op.date::DATE                                                              AS order_date,
    SUM(op.soma_prod)::NUMERIC                                                 AS revenue,
    SUM(SUM(op.soma_prod)) OVER (ORDER BY op.date)::NUMERIC                    AS cumulative_revenue
  FROM order_prods op
  GROUP BY op.date
  ORDER BY op.date;
END;
$function$

;

-- ---------- get_vendas_ranking ----------
CREATE OR REPLACE FUNCTION public.get_vendas_ranking(p_start_date date, p_end_date date, p_unit_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(seller_id uuid, seller_name text, total_revenue numeric, order_count integer, avg_ticket numeric, deals_won integer, conversion_rate numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.check_permission_or_raise('vendas', 'view');

  RETURN QUERY
  WITH
  order_prods AS (
    SELECT
      po.ploomes_order_id,
      po.owner_id,
      COALESCE(SUM(pop.total), 0) AS soma_prod
    FROM public.ploomes_orders po
    LEFT JOIN public.ploomes_order_products pop ON pop.order_id = po.ploomes_order_id
    WHERE po.date BETWEEN p_start_date AND p_end_date
      AND (p_unit_id IS NULL OR po.unit_id = p_unit_id)
    GROUP BY po.ploomes_order_id, po.owner_id
  ),
  ranked_sellers AS (
    SELECT
      s.id                                                               AS seller_id,
      s.name                                                             AS seller_name,
      s.owner_id                                                         AS s_owner_id,
      COALESCE(SUM(op.soma_prod), 0)::NUMERIC                            AS total_revenue,
      COUNT(DISTINCT op.ploomes_order_id)::INTEGER                       AS order_count
    FROM public.sellers s
    LEFT JOIN order_prods op ON op.owner_id = s.owner_id
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
$function$

;

-- ---------- get_upsell_opportunities ----------
CREATE OR REPLACE FUNCTION public.get_upsell_opportunities(p_seller_id uuid DEFAULT NULL::uuid, p_show_contacted boolean DEFAULT false, p_source text DEFAULT 'all'::text)
 RETURNS TABLE(event_id uuid, event_date date, event_title text, deal_id bigint, unit_id uuid, contact_id uuid, ploomes_contact_id bigint, contact_name text, contact_email text, contact_phones jsonb, contact_birthday date, contact_next_anniversary date, contact_prev_anniversary date, contact_owner_id integer, contact_owner_name text, is_carteira_livre boolean, tem_adicional boolean, tem_upgrade boolean, missing_categories text[], log_id uuid, log_outcome text, log_contacted_at timestamp with time zone, log_notes text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_seller_owner_id INTEGER;
BEGIN
  PERFORM public.check_permission_or_raise('vendas', 'view');

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
$function$

;

-- ---------- get_upsell_count_for_user ----------
CREATE OR REPLACE FUNCTION public.get_upsell_count_for_user()
 RETURNS TABLE(my_count integer, carteira_livre_count integer, total integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_seller_id       UUID;
  v_seller_owner_id INTEGER;
  v_role            TEXT;
BEGIN
  SELECT role, seller_id INTO v_role, v_seller_id
  FROM public.users
  WHERE id = auth.uid();

  PERFORM public.check_permission_or_raise('vendas', 'view');

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
$function$

;

-- ---------- get_upsell_popular_addons ----------
CREATE OR REPLACE FUNCTION public.get_upsell_popular_addons(p_package_name text)
 RETURNS TABLE(product_name text, category text, cnt integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.check_permission_or_raise('vendas', 'view');

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
$function$

;

-- ---------- get_recompra_aniversario_proximo ----------
CREATE OR REPLACE FUNCTION public.get_recompra_aniversario_proximo(p_seller_id uuid DEFAULT NULL::uuid, p_show_contacted boolean DEFAULT false, p_source text DEFAULT 'all'::text, p_days_ahead integer DEFAULT 90, p_exclude_recent_months integer DEFAULT 6)
 RETURNS TABLE(deal_id bigint, deal_title text, unit_id uuid, contact_id uuid, ploomes_contact_id bigint, contact_name text, contact_email text, contact_phones jsonb, aniversariante_birthday date, next_birthday date, days_until_birthday integer, contact_owner_id integer, contact_owner_name text, is_carteira_livre boolean, log_id uuid, log_outcome text, log_contacted_at timestamp with time zone, log_notes text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_seller_owner_id INTEGER;
BEGIN
  PERFORM public.check_permission_or_raise('vendas', 'view');

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
  -- Deals ganhos com birthday; ranqueados por (email, birthday) — mais recente primeiro
  -- event_ref_date exposto para o filtro de festas recentes (p_exclude_recent_months)
  ranked_deals AS (
    SELECT
      pd.ploomes_deal_id,
      pd.title                                              AS deal_title,
      pd.unit_id,
      LOWER(TRIM(pd.contact_email))                         AS norm_email,
      pd.aniversariante_birthday,
      pd.owner_id,
      pd.owner_name,
      COALESCE(pd.event_date, pd.ploomes_create_date::DATE) AS event_ref_date,
      ROW_NUMBER() OVER (
        PARTITION BY LOWER(TRIM(pd.contact_email)), pd.aniversariante_birthday
        ORDER BY COALESCE(pd.event_date, pd.ploomes_create_date::DATE) DESC
      ) AS rn
    FROM public.ploomes_deals pd
    WHERE pd.status_id = 2
      AND pd.aniversariante_birthday IS NOT NULL
      AND pd.contact_email IS NOT NULL
  ),
  -- Melhor deal por (email, birthday).
  -- p_exclude_recent_months = 0 → comportamento antigo (sem filtro de recência).
  -- p_exclude_recent_months > 0 → exclui quem fechou festa nos últimos N meses.
  best_deals AS (
    SELECT * FROM ranked_deals
    WHERE rn = 1
      AND (
        p_exclude_recent_months = 0
        OR event_ref_date < CURRENT_DATE - (p_exclude_recent_months || ' months')::INTERVAL
      )
  ),
  -- Calcula próximo aniversário; Feb-29 → Feb-28
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
  -- Filtra pela janela de dias e calcula is_carteira_livre uma vez
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
$function$

;

-- ---------- get_recompra_festa_passada ----------
CREATE OR REPLACE FUNCTION public.get_recompra_festa_passada(p_seller_id uuid DEFAULT NULL::uuid, p_show_contacted boolean DEFAULT false, p_source text DEFAULT 'all'::text)
 RETURNS TABLE(deal_id bigint, deal_title text, unit_id uuid, contact_id uuid, ploomes_contact_id bigint, contact_name text, contact_email text, contact_phones jsonb, aniversariante_birthday date, last_event_date date, months_since_event integer, contact_owner_id integer, contact_owner_name text, is_carteira_livre boolean, log_id uuid, log_outcome text, log_contacted_at timestamp with time zone, log_notes text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_seller_owner_id INTEGER;
BEGIN
  PERFORM public.check_permission_or_raise('vendas', 'view');

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
$function$

;

-- ---------- get_recompra_count_for_user ----------
CREATE OR REPLACE FUNCTION public.get_recompra_count_for_user(p_exclude_recent_months integer DEFAULT 6)
 RETURNS TABLE(aniversario_count integer, festa_passada_count integer, total integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_seller_id       UUID;
  v_seller_owner_id INTEGER;
  v_role            TEXT;
BEGIN
  SELECT role, seller_id INTO v_role, v_seller_id
  FROM public.users
  WHERE id = auth.uid();

  PERFORM public.check_permission_or_raise('vendas', 'view');

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
  -- Deals ganhos com birthday; mais recente por (email, birthday).
  -- event_ref_date exposto para o filtro de festas recentes (p_exclude_recent_months).
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
  -- Melhor deal por (email, birthday).
  -- p_exclude_recent_months = 0 -> comportamento antigo (sem filtro de recencia).
  -- p_exclude_recent_months > 0 -> exclui quem fechou festa nos ultimos N meses.
  best_deals AS (
    SELECT * FROM ranked_deals
    WHERE rn = 1
      AND (
        p_exclude_recent_months = 0
        OR event_ref_date < CURRENT_DATE - (p_exclude_recent_months || ' months')::INTERVAL
      )
  ),
  -- Calcula proximo aniversario; Feb-29 -> Feb-28
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
  -- Aniversarios nos proximos 90 dias, nao contatados
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
  -- Festa passada: sem atividade nos ultimos 10 meses, nao contatados.
  -- Esta secao NAO e afetada por p_exclude_recent_months.
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
$function$

;

-- ---------- get_event_sales_summary ----------
CREATE OR REPLACE FUNCTION public.get_event_sales_summary(p_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deal_id  BIGINT;
  v_deal     JSONB;
  v_prods    JSONB;
  v_contacts JSONB;
BEGIN
  -- Guard: módulo Eventos (consumido em /eventos/[id]; preserva gerente — G-RISK C)
  PERFORM public.check_permission_or_raise('eventos', 'view');

  -- Resolve ploomes_deal_id (TEXT no evento, BIGINT no ploomes_deals)
  SELECT ploomes_deal_id::BIGINT INTO v_deal_id
  FROM public.events
  WHERE id = p_event_id
    AND ploomes_deal_id IS NOT NULL;

  -- ── 1. Deal header ────────────────────────────────────────────
  IF v_deal_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'ploomes_deal_id',    d.ploomes_deal_id,
      'owner_name',         d.owner_name,
      'deal_amount',        d.deal_amount,
      'stage_name',         d.stage_name,
      'status_id',          d.status_id,
      'ploomes_last_update', d.ploomes_last_update
    ) INTO v_deal
    FROM public.ploomes_deals d
    WHERE d.ploomes_deal_id = v_deal_id;
  END IF;

  -- ── 2. Produtos vendidos ──────────────────────────────────────
  IF v_deal_id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'group_name',   pop.group_name,
        'product_name', pop.product_name,
        'quantity',     pop.quantity,
        'total',        pop.total
      ) ORDER BY pop.group_name, pop.product_name
    ), '[]'::jsonb) INTO v_prods
    FROM public.ploomes_orders po
    JOIN public.ploomes_order_products pop ON pop.order_id = po.ploomes_order_id
    WHERE po.deal_id = v_deal_id;
  ELSE
    v_prods := '[]'::jsonb;
  END IF;

  -- ── 3. Histórico de contatos de upsell ───────────────────────
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',                 ucl.id,
      'contacted_at',       ucl.contacted_at,
      'outcome',            ucl.outcome,
      'notes',              ucl.notes,
      'contacted_by_name',  u.name,
      'seller_name',        s.name,
      'reopened_at',        ucl.reopened_at
    ) ORDER BY ucl.contacted_at DESC
  ), '[]'::jsonb) INTO v_contacts
  FROM public.upsell_contact_log ucl
  JOIN public.users u  ON u.id  = ucl.contacted_by
  LEFT JOIN public.sellers s ON s.id = ucl.seller_id
  WHERE ucl.event_id = p_event_id;

  RETURN jsonb_build_object(
    'deal',            v_deal,
    'products',        v_prods,
    'upsell_contacts', v_contacts
  );
END;
$function$

;

-- ============================================================
-- PARTE 2 — Pós-condição: cada RPC chama o guard configurável e
-- não contém mais gate por lista de cargos. (smoke test estrutural,
-- determinístico — substitui chamadas frágeis com auth.uid()=NULL)
-- ============================================================
DO $postcond$
DECLARE
  r     RECORD;
  v_src TEXT;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('get_vendas_my_kpis(uuid,date,date,date,date)',                 'vendas'),
    ('get_vendas_daily_revenue(uuid,date,date)',                     'vendas'),
    ('get_vendas_ranking(date,date,uuid)',                           'vendas'),
    ('get_upsell_opportunities(uuid,boolean,text)',                  'vendas'),
    ('get_upsell_count_for_user()',                                  'vendas'),
    ('get_upsell_popular_addons(text)',                              'vendas'),
    ('get_recompra_aniversario_proximo(uuid,boolean,text,integer,integer)', 'vendas'),
    ('get_recompra_festa_passada(uuid,boolean,text)',               'vendas'),
    ('get_recompra_count_for_user(integer)',                         'vendas'),
    ('get_event_sales_summary(uuid)',                                'eventos')
  ) AS t(sig, modulo) LOOP
    v_src := pg_get_functiondef(('public.' || r.sig)::regprocedure);

    IF position('check_permission_or_raise(''' || r.modulo || ''', ''view'')' IN v_src) = 0 THEN
      RAISE EXCEPTION 'Pós-condição falhou: % não chama check_permission_or_raise(%, view).', r.sig, r.modulo;
    END IF;

    IF position('role IN (''super_admin''' IN v_src) > 0
       OR position('role NOT IN (''super_admin''' IN v_src) > 0 THEN
      RAISE EXCEPTION 'Pós-condição falhou: % ainda contém gate por lista de cargos.', r.sig;
    END IF;
  END LOOP;

  RAISE NOTICE 'OK: 10 RPCs convertidos (9 vendas.view + 1 eventos.view), sem gate por cargo residual.';
END
$postcond$;

NOTIFY pgrst, 'reload schema';

COMMIT;
