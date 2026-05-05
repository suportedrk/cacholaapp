-- =============================================================
-- Migration 082: Recompra Count — aplicar filtro p_exclude_recent_months
--   Recria get_recompra_count_for_user adicionando o parametro
--   p_exclude_recent_months (default 6) para manter coerencia com
--   get_recompra_aniversario_proximo (migration 081).
--   Antes: badge mostrava ~143 (sem filtro); lista mostrava ~63 (com filtro).
--   Depois: badge e lista usam a mesma regra de exclusao de festas recentes.
-- =============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- DROP com assinatura antiga (0 params) obrigatorio antes de
-- CREATE OR REPLACE com 1 param — PostgreSQL nao permite alterar
-- a lista de parametros via OR REPLACE sem DROP previo.
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_recompra_count_for_user();

CREATE OR REPLACE FUNCTION public.get_recompra_count_for_user(
  p_exclude_recent_months INT DEFAULT 6
)
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
$$;

COMMENT ON FUNCTION public.get_recompra_count_for_user IS $comment$
Recompra > Contagens agregadas para os badges das abas Aniversario e Festa Passada.

Retorna duas contagens: aniversario_count (oportunidades de aniversario nos proximos 90 dias com filtro de exclusao de festas recentes) e festa_passada_count (oportunidades de festa passada na janela 10-13 meses, sem atividade recente).

Filtro p_exclude_recent_months (default 6): exclui aniversariantes cujo deal ganho mais recente teve event_date dentro dos ultimos N meses, mantendo coerencia com get_recompra_aniversario_proximo. Use 0 para preservar comportamento antigo (sem exclusao por janela de tempo).

Esta funcao e a fonte de verdade dos badges das abas. Sempre que get_recompra_aniversario_proximo for ajustada na regra de aniversario, esta funcao deve ser ajustada em conjunto para evitar inconsistencia visual entre badge e lista.
$comment$;

NOTIFY pgrst, 'reload schema';

COMMIT;
