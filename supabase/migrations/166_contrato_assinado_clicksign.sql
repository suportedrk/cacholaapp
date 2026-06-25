-- Migration 166 - Contrato assinado (Clicksign) por festa.
-- Padrao esteira: sem BEGIN/COMMIT/ROLLBACK nem NOTIFY pgrst (a esteira gerencia a transacao e recarrega o schema apos o commit).
--
-- Campo de origem: "Assinado (Clicksign)" na entidade ORDER do Ploomes (EntityId=4).
--   FieldKey = order_7B61B5EB-7BBB-406E-808E-EE9BDF17AA9C
--   TypeId   = 10 (checkbox). Na API vem como BoolValue=true quando marcado;
--              quando desmarcado, o Ploomes OMITE a propriedade do array OtherProperties.
--
-- Regra de negocio: uma festa (deal) pode ter VARIOS documentos de venda (orders).
--   Nem todo documento e assinado. A festa esta "assinada" se QUALQUER order tiver
--   BoolValue=true; caso contrario (todas omitidas/false), nao assinado.
--
-- Modelo de 3 estados em events.contract_signed (boolean NULLABLE):
--   NULL  -> festa sem nenhum documento de venda (sem order) -> etiqueta escondida
--   false -> tem order(s), nenhuma assinada                 -> etiqueta "Nao assinado"
--   true  -> >= 1 order assinada                            -> etiqueta "Assinado"
-- O agregado e mantido pelo sync (refreshEventContractSignedFromOrders) e pelo backfill.

-- 1. Coluna por-order (espelho direto do checkbox do Ploomes).
ALTER TABLE public.ploomes_orders
  ADD COLUMN IF NOT EXISTS contract_signed BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.ploomes_orders.contract_signed IS
  'Checkbox "Assinado (Clicksign)" do Order no Ploomes (FieldKey order_7B61B5EB-...). true = BoolValue=true na API; false = propriedade omitida/false.';

-- 2. Coluna agregada por-festa (3 estados via NULL).
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS contract_signed BOOLEAN;

COMMENT ON COLUMN public.events.contract_signed IS
  'Contrato assinado (Clicksign) agregado das orders do deal. NULL = sem documento de venda; false = tem order(s) sem assinatura; true = >= 1 order assinada. Mantido pelo sync de orders.';

-- 3. FieldKey configuravel (mesmo padrao de cliente_cachola_field_key / aniversariante_birthday_field_key).
ALTER TABLE public.ploomes_config
  ADD COLUMN IF NOT EXISTS clicksign_signed_field_key TEXT;

UPDATE public.ploomes_config
SET clicksign_signed_field_key = 'order_7B61B5EB-7BBB-406E-808E-EE9BDF17AA9C'
WHERE clicksign_signed_field_key IS NULL;

-- 4. Indice parcial para o filtro "Contrato nao assinado" (festas nos proximos 30 dias).
--    Seletivo: so indexa as nao assinadas (predicado raro vs. total), ordenado por data.
CREATE INDEX IF NOT EXISTS idx_events_contract_unsigned
  ON public.events (date)
  WHERE contract_signed = false;
