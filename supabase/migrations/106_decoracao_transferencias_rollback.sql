-- Rollback da migration 106: Bloco 4 — transferências (romaneio).
-- IMPORTANTE: rollback apaga TODAS as transferências e itens registrados.
-- Os saldos em decoracao_estoque_saldo NÃO são revertidos — se houver
-- transferências em_transito ao rodar este rollback, o saldo da origem
-- ficará subtraído sem registro. Use apenas em dev.

BEGIN;

DROP FUNCTION IF EXISTS public.cancelar_transferencia(UUID);
DROP FUNCTION IF EXISTS public.receber_transferencia(UUID);
DROP FUNCTION IF EXISTS public.criar_transferencia(UUID, UUID, TEXT, JSONB);

DROP TABLE IF EXISTS public.decoracao_transferencia_itens;
DROP TABLE IF EXISTS public.decoracao_transferencias;

DROP FUNCTION IF EXISTS public.trg_transferencias_updated_at();

NOTIFY pgrst, 'reload schema';

COMMIT;
