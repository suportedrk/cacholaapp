-- =============================================================
-- Migration 063: Recompra — Fase D.1 Infraestrutura
--   1. ALTER ploomes_deals    — aniversariante_birthday
--   2. ALTER ploomes_config   — aniversariante_birthday_field_key
--   3. CREATE TABLE recompra_contact_log
--   4. get_recompra_aniversario_proximo — aniversários nos próximos N dias
--   5. get_recompra_festa_passada       — clientes prontos para reconquistar
--   6. get_recompra_count_for_user      — badge sidebar
-- =============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. ploomes_deals: colunas de aniversariante
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.ploomes_deals
  ADD COLUMN IF NOT EXISTS aniversariante_birthday          DATE,
  ADD COLUMN IF NOT EXISTS aniversariante_birthday_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ploomes_deals_birthday
  ON public.ploomes_deals (aniversariante_birthday)
  WHERE aniversariante_birthday IS NOT NULL;

COMMENT ON COLUMN public.ploomes_deals.aniversariante_birthday IS
  'Data de nascimento do aniversariante (FieldKey deal_13506031-C53E-48A0-A92B-686F76AC77ED). Populada pelo sync-deals.ts.';

-- ─────────────────────────────────────────────────────────────
-- 2. ploomes_config: field_key do campo birthday
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.ploomes_config
  ADD COLUMN IF NOT EXISTS aniversariante_birthday_field_key TEXT;

UPDATE public.ploomes_config
  SET aniversariante_birthday_field_key = 'deal_13506031-C53E-48A0-A92B-686F76AC77ED'
  WHERE aniversariante_birthday_field_key IS NULL;

COMMENT ON COLUMN public.ploomes_config.aniversariante_birthday_field_key IS
  'FieldKey Ploomes do campo "Data de Nascimento do aniversariante" em Deals. Confirmado via script discover-aniversariante-fieldkey.ts.';

-- ─────────────────────────────────────────────────────────────
-- 3. recompra_contact_log
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.recompra_contact_log (
  id                           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Chave lógica da oportunidade
  contact_email                TEXT        NOT NULL,
  aniversariante_birthday      DATE        NOT NULL,
  recompra_type                TEXT        NOT NULL
    CHECK (recompra_type IN ('aniversario', 'festa_passada')),
  -- Quem fez o contato
  seller_id                    UUID        NOT NULL REFERENCES public.sellers(id)  ON DELETE RESTRICT,
  contacted_by                 UUID        NOT NULL REFERENCES public.users(id)    ON DELETE RESTRICT,
  -- Resultado
  outcome                      TEXT        NOT NULL
    CHECK (outcome IN ('tentou', 'recusou', 'vendeu', 'outro')),
  notes                        TEXT,
  captured_from_carteira_livre BOOLEAN     NOT NULL DEFAULT false,
  -- Timestamps
  contacted_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  reopened_at                  TIMESTAMPTZ,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Um contato ativo por (email, birthday, tipo)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_recompra_log_active
  ON public.recompra_contact_log (contact_email, aniversariante_birthday, recompra_type)
  WHERE reopened_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_recompra_log_seller
  ON public.recompra_contact_log (seller_id, contacted_at DESC);

CREATE INDEX IF NOT EXISTS idx_recompra_log_contact
  ON public.recompra_contact_log (contact_email, aniversariante_birthday);

ALTER TABLE public.recompra_contact_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY recompra_log_select ON public.recompra_contact_log
  FOR SELECT TO authenticated
  USING (
    contacted_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('super_admin', 'diretor', 'gerente')
    )
  );

CREATE POLICY recompra_log_insert ON public.recompra_contact_log
  FOR INSERT TO authenticated
  WITH CHECK (
    contacted_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('super_admin', 'diretor', 'gerente', 'vendedora')
    )
  );

CREATE POLICY recompra_log_update ON public.recompra_contact_log
  FOR UPDATE TO authenticated
  USING  (contacted_by = auth.uid())
  WITH CHECK (contacted_by = auth.uid());

CREATE TRIGGER update_recompra_contact_log_updated_at
  BEFORE UPDATE ON public.recompra_contact_log
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE public.recompra_contact_log IS
  'Log de contatos de recompra (aniversário próximo + festa passada). UNIQUE WHERE reopened_at IS NULL garante um contato ativo por (email, birthday, tipo).';

-- ─────────────────────────────────────────────────────────────
-- 4. get_recompra_aniversario_proximo
-- ─────────────────────────────────────────────────────────────
-- Retorna contatos cujo aniversário do filho está nos próximos
-- p_days_ahead dias (default 90).
-- Agrupamento: (email, aniversariante_birthday) — Ajuste 3.
-- Precedência: deal mais recente por grupo (COALESCE event_date) — Ajuste 2.
-- Feb-29 → usa Feb-28 como proxy.
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
      AND role IN ('super_admin','diretor','gerente','vendedora')
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
  -- Deals ganhos com birthday; ranqueados por (email, birthday) — mais recente primeiro
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
  -- Filtra pela janela e calcula is_carteira_livre uma vez
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

-- ─────────────────────────────────────────────────────────────
-- 5. get_recompra_festa_passada
-- ─────────────────────────────────────────────────────────────
-- Retorna contatos cujo último deal ganho (com birthday) foi há
-- mais de 10 meses E que não têm nenhum deal (status=1 ou 2) nos
-- últimos 10 meses — prontos para reconquistar.
-- Agrupamento: (email, aniversariante_birthday) — Ajuste 3.
-- Exclusão 10 meses: Ajuste 4.
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
      AND role IN ('super_admin','diretor','gerente','vendedora')
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
  -- Deals ganhos com birthday; deal mais recente por (email, birthday) — Ajuste 2/3
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
  -- Calcula is_carteira_livre e filtra oportunidades válidas
  candidates AS (
    SELECT
      bd.*,
      NOT EXISTS (
        SELECT 1 FROM active_seller_owner_ids aso
        WHERE aso.owner_id = bd.owner_id
      ) AS is_carteira_livre
    FROM best_deals bd
    -- Ajuste 4: exclui quem tem qualquer deal ativo/ganho nos últimos 10 meses
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

-- ─────────────────────────────────────────────────────────────
-- 6. get_recompra_count_for_user
-- ─────────────────────────────────────────────────────────────
-- Retorna contagens para badge da sidebar (apenas não contatados).
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_recompra_count_for_user();

CREATE FUNCTION public.get_recompra_count_for_user()
RETURNS TABLE(
  aniversario_count  INTEGER,
  festa_passada_count INTEGER,
  total              INTEGER
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
  -- Deals ganhos com birthday; mais recente por (email, birthday)
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
  -- Próximo aniversário (Feb-29 → Feb-28)
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
  -- Aniversários nos próximos 90 dias, não contatados
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
  -- Festa passada: sem atividade nos últimos 10 meses, não contatados
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

COMMIT;
