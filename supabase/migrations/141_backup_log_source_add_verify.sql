-- ============================================================
-- Migration 141 — backup_log: permitir source = 'verify'
-- ------------------------------------------------------------
-- Objetivo: dar voz ao backup-verify.sh (que hoje detecta corrupção
-- mas é mudo). A correção faz o verify gravar uma linha
-- status='failed' em public.backup_log, reaproveitando o alerta
-- existente (cron backup-check, condição status='failed', agnóstica
-- de kind/source).
--
-- A linha do verify NÃO pode usar source='local' (colidiria com a
-- linha de sucesso do backup-full pelo índice único kind,source,
-- filename + ON CONFLICT DO NOTHING). Por isso introduzimos um novo
-- valor de source, 'verify', mantendo 'local' e 'r2_upload'.
--
-- DDL pura, sem alteração de dados — as linhas existentes só usam
-- 'local'/'r2_upload', então o novo CHECK as satisfaz.
-- ============================================================

BEGIN;

ALTER TABLE public.backup_log
  DROP CONSTRAINT IF EXISTS backup_log_source_check;

ALTER TABLE public.backup_log
  ADD CONSTRAINT backup_log_source_check
  CHECK (source IN ('local', 'r2_upload', 'verify'));

COMMIT;
