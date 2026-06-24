-- Migration 165 - Campos do Checklist de Decoracao vindos do Ploomes.
-- Padrao esteira: sem BEGIN/COMMIT/ROLLBACK nem NOTIFY pgrst (a esteira gerencia a transacao e recarrega o schema apos o commit).
-- Adiciona 9 colunas em events que espelham campos customizados de DEAL do grupo "CHECKLIST - DECORACAO" do Ploomes.
-- Os outros 7 campos do checklist de decoracao ja existem em events (theme, decorator_name, setup_time, teardown_time, briefing, cake_flavor, has_decorated_sweets) e sao reaproveitados.
-- Todas nullable: nenhum e obrigatorio no Ploomes (cobertura parcial 4%-22% na amostra). Sem indices: sao colunas exibidas no detalhe do evento, sem uso em filtro/join.
-- Nao altera RLS (atributos do evento, ja cobertos pelas policies existentes de events).
-- ATENCAO (balloons_value / fake_cake_value): no painel do Ploomes os dois campos "Valor cobrado" estao declarados como TypeId 5 (Data/hora), mas na pratica gravam DecimalValue (R$). Confirmado por amostragem de deals reais (ex.: Baloes 1800, Bolo Fake 300). Por isso a coluna e numeric e o field-mapping le DecimalValue, nao DateTimeValue.
-- Mapeamento FieldKey -> coluna (ver src/lib/ploomes/field-mapping.ts):
--   deal_7CB6A6A2... Responsavel da Decoracao - Observacoes (BigStringValue) -> decorator_notes
--   deal_29B4CC3C... Forminhas - Cores                      (BigStringValue, codigos ex.: "10,6,9,26") -> forminhas_colors
--   deal_D56C449B... Oficinas - Observacoes                 (BigStringValue) -> workshops_notes
--   deal_CA67DC60... Baloes - Valor cobrado                 (DecimalValue/moeda) -> balloons_value
--   deal_EF8082BC... Baloes - Observacoes                   (BigStringValue) -> balloons_notes
--   deal_040C6AD0... Bolo Fake - Valor Cobrado              (DecimalValue/moeda) -> fake_cake_value
--   deal_62E5F9A1... Bolo Fake - Observacoes                (BigStringValue) -> fake_cake_notes
--   deal_E2249487... Doces Decorados - Observacoes          (BigStringValue) -> decorated_sweets_notes
--   deal_36396B6F... Adicionais de Decoracao - Observacoes  (BigStringValue) -> decoration_addons_notes

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS decorator_notes         text,
  ADD COLUMN IF NOT EXISTS forminhas_colors        text,
  ADD COLUMN IF NOT EXISTS workshops_notes         text,
  ADD COLUMN IF NOT EXISTS balloons_value          numeric,
  ADD COLUMN IF NOT EXISTS balloons_notes          text,
  ADD COLUMN IF NOT EXISTS fake_cake_value         numeric,
  ADD COLUMN IF NOT EXISTS fake_cake_notes         text,
  ADD COLUMN IF NOT EXISTS decorated_sweets_notes  text,
  ADD COLUMN IF NOT EXISTS decoration_addons_notes text;

COMMENT ON COLUMN public.events.decorator_notes IS
  'Observacoes do responsavel da decoracao (campo de DEAL "Responsavel da Decoracao - Observacoes", FieldKey deal_7CB6A6A2, BigStringValue). Nullable. Migration 165.';
COMMENT ON COLUMN public.events.forminhas_colors IS
  'Cores das forminhas (campo de DEAL "Forminhas - Cores", FieldKey deal_29B4CC3C, BigStringValue de texto livre; no Ploomes vem como codigos, ex.: "10,6,9,26"). Nullable. Migration 165.';
COMMENT ON COLUMN public.events.workshops_notes IS
  'Observacoes das oficinas (campo de DEAL "Oficinas - Observacoes", FieldKey deal_D56C449B, BigStringValue). Nullable. Migration 165.';
COMMENT ON COLUMN public.events.balloons_value IS
  'Valor cobrado pelos baloes (campo de DEAL "Baloes - Valor cobrado", FieldKey deal_CA67DC60). Declarado como Data/hora no Ploomes mas grava DecimalValue/moeda na pratica; lido como numero. Nullable. Migration 165.';
COMMENT ON COLUMN public.events.balloons_notes IS
  'Observacoes dos baloes (campo de DEAL "Baloes - Observacoes", FieldKey deal_EF8082BC, BigStringValue). Nullable. Migration 165.';
COMMENT ON COLUMN public.events.fake_cake_value IS
  'Valor cobrado pelo bolo fake (campo de DEAL "Bolo Fake - Valor Cobrado", FieldKey deal_040C6AD0). Declarado como Data/hora no Ploomes mas grava DecimalValue/moeda na pratica; lido como numero. Nullable. Migration 165.';
COMMENT ON COLUMN public.events.fake_cake_notes IS
  'Observacoes do bolo fake (campo de DEAL "Bolo Fake - Observacoes", FieldKey deal_62E5F9A1, BigStringValue). Nullable. Migration 165.';
COMMENT ON COLUMN public.events.decorated_sweets_notes IS
  'Observacoes dos doces decorados (campo de DEAL "Doces Decorados - Observacoes", FieldKey deal_E2249487, BigStringValue). Complementa has_decorated_sweets (booleano "Doces Decorados - Sim ou Nao"). Nullable. Migration 165.';
COMMENT ON COLUMN public.events.decoration_addons_notes IS
  'Observacoes dos adicionais de decoracao (campo de DEAL "Adicionais de Decoracao - Observacoes", FieldKey deal_36396B6F, BigStringValue). Nullable. Migration 165.';
