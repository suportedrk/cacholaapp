-- ============================================================
-- Migration 120 — ROLLBACK
-- Remove o helper check_permission_or_raise.
--
-- Seguro de rodar enquanto o helper não tiver sido adotado por nenhuma
-- RPC. Aplicar este rollback DEPOIS de qualquer conversão da Etapa 1
-- quebraria as RPCs convertidas (DROP CASCADE listaria dependências).
-- ============================================================

BEGIN;

DROP FUNCTION IF EXISTS public.check_permission_or_raise(TEXT, TEXT);

COMMIT;

NOTIFY pgrst, 'reload schema';
