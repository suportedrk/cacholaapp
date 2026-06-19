-- Migration 162 - Campos do Checklist do Cliente vindos do Ploomes (Fase 2b-1).
-- Padrao esteira: sem BEGIN/COMMIT/ROLLBACK nem NOTIFY pgrst (a esteira gerencia a transacao e recarrega o schema apos o commit).
-- Adiciona 9 colunas em events que espelham campos customizados de DEAL do grupo "CHECKLIST - CLIENTE" do Ploomes.
-- Todas nullable: nenhum e obrigatorio no Ploomes (cobertura parcial). Sem indices: sao colunas exibidas no detalhe do evento, sem uso em filtro/join.
-- Nao altera RLS (atributos do evento, ja cobertos pelas policies existentes de events).
-- Mapeamento FieldKey -> coluna (ver src/lib/ploomes/field-mapping.ts):
--   deal_F42FF428... Quantidade Rolha           (IntegerValue)  -> corkage_quantity
--   deal_BA8CEB23... Valor Convidado Extra/Staff (DecimalValue)  -> extra_guest_staff_value
--   deal_993CA06F... Responsavel                 (StringValue)   -> responsible_person
--   deal_459AC176... Contato(s) Foto/Video       (BigStringValue)-> photo_video_contact
--   deal_5057B43F... Gerador                     (ObjectValueName, select) -> generator
--   deal_E1A6E631... Valet Custos                (ObjectValueName, select) -> valet_cost
--   deal_0B67A37D... Outros Detalhes Checklist   (BigStringValue)-> checklist_other_details
--   deal_20EAB3E0... Pagou Rolha?                (StringValue)   -> corkage_paid
--   deal_F76459D8... Detalhamento Hora Extra     (BigStringValue)-> overtime_details

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS corkage_quantity        integer,
  ADD COLUMN IF NOT EXISTS extra_guest_staff_value numeric,
  ADD COLUMN IF NOT EXISTS responsible_person      text,
  ADD COLUMN IF NOT EXISTS photo_video_contact     text,
  ADD COLUMN IF NOT EXISTS generator               text,
  ADD COLUMN IF NOT EXISTS valet_cost              text,
  ADD COLUMN IF NOT EXISTS checklist_other_details text,
  ADD COLUMN IF NOT EXISTS corkage_paid            text,
  ADD COLUMN IF NOT EXISTS overtime_details        text;

COMMENT ON COLUMN public.events.corkage_quantity IS
  'Quantidade de rolha (campo de DEAL "Quantidade Rolha", FieldKey deal_F42FF428, IntegerValue). Nullable. Migration 162.';
COMMENT ON COLUMN public.events.extra_guest_staff_value IS
  'Valor do convidado extra e staff (campo de DEAL "Valor do Convidado Extra e Staff", FieldKey deal_BA8CEB23, DecimalValue/moeda). Nullable. Migration 162.';
COMMENT ON COLUMN public.events.responsible_person IS
  'Responsavel pelo checklist do cliente (campo de DEAL "Responsavel", FieldKey deal_993CA06F, StringValue). Nao confundir com owner/vendedora do deal. Nullable. Migration 162.';
COMMENT ON COLUMN public.events.photo_video_contact IS
  'Contato(s) do fornecedor de foto/video (campo de DEAL "Contato(s) foto e/ou video", FieldKey deal_459AC176, BigStringValue). Distinto de photo_video (que e "Contratou foto/video?"). Nullable. Migration 162.';
COMMENT ON COLUMN public.events.generator IS
  'Gerador (campo de DEAL "Gerador", FieldKey deal_5057B43F, select lido via ObjectValueName). Nullable. Migration 162.';
COMMENT ON COLUMN public.events.valet_cost IS
  'Valet custos (campo de DEAL "Valet custos", FieldKey deal_E1A6E631, select lido via ObjectValueName). Nullable. Migration 162.';
COMMENT ON COLUMN public.events.checklist_other_details IS
  'Outros detalhes do checklist do cliente (campo de DEAL "Outros detalhes Checklist Cliente", FieldKey deal_0B67A37D, BigStringValue). Nullable. Migration 162.';
COMMENT ON COLUMN public.events.corkage_paid IS
  'Pagou rolha? (campo de DEAL "Pagou Rolha?", FieldKey deal_20EAB3E0, StringValue de texto livre, ex.: "Sim - Vinho"). Nullable. Migration 162.';
COMMENT ON COLUMN public.events.overtime_details IS
  'Detalhamento de hora extra (campo de DEAL "Detalhamento de Hora Extra", FieldKey deal_F76459D8, BigStringValue). Nullable. Migration 162.';
