-- =============================================================
-- Migration 047 — Pré-reserva Ploomes
-- Adiciona start_time/end_time em ploomes_deals e cria a VIEW
-- =============================================================

BEGIN;

-- ----- PARTE 1 — Adicionar colunas de horário em ploomes_deals -----

ALTER TABLE ploomes_deals
  ADD COLUMN IF NOT EXISTS start_time TIME NULL,
  ADD COLUMN IF NOT EXISTS end_time   TIME NULL;

COMMENT ON COLUMN ploomes_deals.start_time IS
  'Horário de início do evento (FieldKey Ploomes 30E82221-76E2-4882-BB33-F7FB96AC861E). NULL quando vendedor ainda não preencheu.';

COMMENT ON COLUMN ploomes_deals.end_time IS
  'Horário de fim do evento (FieldKey Ploomes FD135180-0186-46F1-8AB7-F0E1C02171B3). NULL quando vendedor ainda não preencheu.';

-- Índice parcial para acelerar consulta da view
CREATE INDEX IF NOT EXISTS idx_ploomes_deals_pre_reserva_lookup
  ON ploomes_deals (stage_id, status_id, event_date)
  WHERE status_id = 1 AND stage_id IN (60004416, 60056754);

-- ----- PARTE 2 — VIEW pre_reservas_ploomes_view -----

CREATE OR REPLACE VIEW pre_reservas_ploomes_view
WITH (security_invoker = true)
AS
SELECT
  pd.ploomes_deal_id::text                                        AS id,
  pd.ploomes_deal_id                                              AS deal_id,
  pd.unit_id,
  pd.event_date                                                   AS date,
  pd.start_time,
  pd.end_time,
  pd.contact_name                                                 AS client_name,
  pd.contact_phone                                                AS client_contact,
  pd.title                                                        AS deal_title,
  pd.deal_amount,
  pd.stage_id,
  pd.stage_name,
  pd.created_at,
  pd.updated_at,
  'https://app10.ploomes.com/deal/' || pd.ploomes_deal_id::text   AS ploomes_url,
  'ploomes'::text                                                 AS source
FROM ploomes_deals pd
WHERE pd.status_id = 1                          -- Em aberto (perdidos ignorados; ganhos não ocorrem aqui)
  AND pd.stage_id IN (60004416, 60056754)       -- Fechamento (60004416) + Assinando Contrato (60056754)
  AND pd.event_date IS NOT NULL                 -- Sem data = sem onde mostrar no calendário
  AND pd.event_date >= CURRENT_DATE - INTERVAL '7 days';  -- Janela: 7d atrás até o futuro

COMMENT ON VIEW pre_reservas_ploomes_view IS
  'Pré-reservas derivadas de deals Ploomes em estágios Fechamento (60004416) + Assinando Contrato (60056754) com status Em aberto (status_id=1). Read-only — fonte é ploomes_deals. Herda RLS via security_invoker.';

-- ----- PARTE 3 — Grants -----

GRANT SELECT ON pre_reservas_ploomes_view TO authenticated;

COMMIT;
