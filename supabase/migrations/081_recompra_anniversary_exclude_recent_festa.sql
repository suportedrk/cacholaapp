-- =============================================================
-- Migration 081: Recompra Aniversário — excluir festas recentes
--   Recria get_recompra_aniversario_proximo adicionando o parâmetro
--   p_exclude_recent_months (default 6) que filtra contatos cujo
--   deal mais recente (event_ref_date) caiu nos últimos N meses.
--   Motivo: evitar abordagem de quem acabou de festejar.
-- =============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- Recriar get_recompra_aniversario_proximo
-- DROP com assinatura antiga (4 params) obrigatório antes de
-- CREATE OR REPLACE com 5 params — PostgreSQL não permite alterar
-- a lista de parâmetros via OR REPLACE sem DROP prévio.
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_recompra_aniversario_proximo(UUID, BOOLEAN, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.get_recompra_aniversario_proximo(
  p_seller_id             UUID    DEFAULT NULL,
  p_show_contacted        BOOLEAN DEFAULT false,
  p_source                TEXT    DEFAULT 'all',
  p_days_ahead            INTEGER DEFAULT 90,
  p_exclude_recent_months INT     DEFAULT 6
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
$$;

COMMENT ON FUNCTION public.get_recompra_aniversario_proximo IS $comment$
Recompra > Aniversário.

O que esta função retorna: clientes que já fecharam festa com a gente em algum momento, e cujo aniversariante está completando idade nos próximos N dias (default 90, parâmetro p_days_ahead). A ideia é abordar essas pessoas antes da concorrência.

Quem NÃO aparece (filtros aplicados):
- Quem fechou festa nos últimos p_exclude_recent_months meses (default 6) — provavelmente acabou de festejar.
- Quem nunca teve deal ganho (a função só considera status_id = 2).
- Quem foi marcado como contatado em recompra_contact_log (a menos que p_show_contacted = true).

De onde vem os dados: ploomes_deals (sincronizado a cada 15 minutos) com status_id = 2 (Ganho). A data de aniversário vem da coluna aniversariante_birthday (campo customizado do Ploomes).

Filtro p_source: mine retorna apenas oportunidades cujo owner_id no Ploomes coincide com o seller logado; carteira_livre retorna oportunidades sem vendedora ativa atribuída; all retorna tudo. Hoje o front sempre passa all e filtra client-side.
$comment$;

NOTIFY pgrst, 'reload schema';

COMMIT;
