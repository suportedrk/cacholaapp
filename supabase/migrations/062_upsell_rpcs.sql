-- =============================================================
-- Migration 062: RPCs de Upsell + tabelas auxiliares
--   1. ALTER upsell_contact_log — captured_from_carteira_livre
--   2. email_sent_log            — dedup de e-mails diários
--   3. get_upsell_opportunities  — lista de oportunidades
--   4. get_upsell_count_for_user — contagem para badge
--   5. get_upsell_popular_addons — sugestão de complementos
-- =============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Estende upsell_contact_log
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.upsell_contact_log
  ADD COLUMN IF NOT EXISTS captured_from_carteira_livre BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.upsell_contact_log.captured_from_carteira_livre IS
  'Indica que o contato foi feito a partir da Carteira Livre (contato de vendedora inativa ou órfão).';

-- ─────────────────────────────────────────────────────────────
-- 2. email_sent_log — controle de dedup de e-mails diários
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_sent_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type        TEXT        NOT NULL,
  recipient_user_id UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sent_date         DATE        NOT NULL DEFAULT CURRENT_DATE,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_email_sent_log_per_day
  ON public.email_sent_log (email_type, recipient_user_id, sent_date);

CREATE INDEX IF NOT EXISTS idx_email_sent_log_recipient
  ON public.email_sent_log (recipient_user_id, sent_at DESC);

ALTER TABLE public.email_sent_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_sent_log_select ON public.email_sent_log
  FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid());

COMMENT ON TABLE public.email_sent_log IS
  'Registro de e-mails enviados para dedup diário. uniq_email_sent_log_per_day impede envio duplicado no mesmo dia.';

-- ─────────────────────────────────────────────────────────────
-- 3. get_upsell_opportunities
-- ─────────────────────────────────────────────────────────────
-- Retorna eventos (30–40 dias à frente, status='confirmed') que
-- têm oportunidade de upsell (falta Adicional OU Upgrade).
-- Filtros:
--   p_seller_id     → UUID do seller (NULL = gestor, vê tudo)
--   p_show_contacted → se TRUE, inclui já contatados
--   p_source         → 'mine' | 'carteira_livre' | 'all'
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
  -- Guard: role check
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin','diretor','gerente','vendedora')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  -- Resolve owner_id from seller UUID (needed for 'mine' filter)
  IF p_seller_id IS NOT NULL THEN
    SELECT owner_id INTO v_seller_owner_id
    FROM public.sellers
    WHERE id = p_seller_id;
  END IF;

  RETURN QUERY
  WITH
  -- Produtos por deal: tem_adicional / tem_upgrade
  products_per_deal AS (
    SELECT
      po.deal_id,
      BOOL_OR(normalize_product_category(pop.group_name) = 'Adicionais') AS tem_adicional,
      BOOL_OR(normalize_product_category(pop.group_name) = 'Upgrades')   AS tem_upgrade
    FROM public.ploomes_orders po
    JOIN public.ploomes_order_products pop ON pop.order_id = po.ploomes_order_id
    GROUP BY po.deal_id
  ),
  -- Sellers ativos (para detectar Carteira Livre)
  active_seller_owner_ids AS (
    SELECT owner_id
    FROM public.sellers
    WHERE status = 'active'
      AND is_system_account = false
      AND owner_id IS NOT NULL
  ),
  -- Eventos no janela 30–40 dias
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
      -- Carteira Livre: owner não está entre sellers ativos
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
      -- Option B: falta Adicional OU falta Upgrade (OR)
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
    -- Quais categorias estão faltando
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
    -- Filtro: já contatados
    (p_show_contacted OR b.log_id IS NULL)
    -- Filtro: fonte (mine / carteira_livre / all)
    AND (
      p_source = 'all'
      OR (p_source = 'carteira_livre' AND b.is_carteira_livre)
      OR (p_source = 'mine'
          AND NOT b.is_carteira_livre
          AND (
            p_seller_id IS NULL                        -- gestor vê tudo em 'mine'
            OR b.contact_owner_id = v_seller_owner_id  -- vendedora vê só os seus
          ))
    )
  ORDER BY b.event_date, b.contact_name;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. get_upsell_count_for_user
-- ─────────────────────────────────────────────────────────────
-- Retorna contagens para o badge da sidebar.
-- Usa auth.uid() → busca seller_id do usuário.
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

  IF v_role NOT IN ('super_admin','diretor','gerente','vendedora') THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  -- Para vendedoras, resolve owner_id
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
      -- Só não contatados (para badge = urgência)
      AND NOT EXISTS (
        SELECT 1 FROM public.upsell_contact_log ucl
        WHERE ucl.event_id = e.id
          AND ucl.reopened_at IS NULL
      )
  )
  SELECT
    -- my_count: não-Carteira Livre filtrado por vendedora (ou tudo para gestor)
    COUNT(CASE
      WHEN NOT o.is_carteira_livre
           AND (v_seller_id IS NULL OR o.contact_owner_id = v_seller_owner_id)
      THEN 1
    END)::INTEGER,
    -- carteira_livre_count: sempre exibe para todos com acesso ao módulo
    COUNT(CASE WHEN o.is_carteira_livre THEN 1 END)::INTEGER,
    -- total
    COUNT(*)::INTEGER
  FROM opps o;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5. get_upsell_popular_addons
-- ─────────────────────────────────────────────────────────────
-- Dado um nome de pacote (ou parte), retorna os 10 produtos
-- das categorias Adicionais/Upgrades mais frequentes nos pedidos
-- que também contêm aquele pacote.
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
      AND role IN ('super_admin','diretor','gerente','vendedora')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  RETURN QUERY
  WITH orders_with_package AS (
    -- Orders que contêm pelo menos um produto do pacote indicado
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

COMMIT;
