-- ============================================================
-- Rollback da Migration 141 — backup_log: remover 'verify' do CHECK
-- ------------------------------------------------------------
-- Restaura o CHECK de source para aceitar apenas 'local' e 'r2_upload'.
--
-- ⚠️ ATENÇÃO: só aplicar se NÃO existir nenhuma linha com source='verify'.
-- Caso contrário, o ADD CONSTRAINT falha (as linhas violariam o CHECK
-- antigo). Para checar antes:
--   SELECT count(*) FROM public.backup_log WHERE source = 'verify';
-- Se houver, decidir entre arquivá-las ou removê-las antes do rollback.
-- ============================================================

BEGIN;

ALTER TABLE public.backup_log
  DROP CONSTRAINT IF EXISTS backup_log_source_check;

ALTER TABLE public.backup_log
  ADD CONSTRAINT backup_log_source_check
  CHECK (source IN ('local', 'r2_upload'));

COMMIT;
