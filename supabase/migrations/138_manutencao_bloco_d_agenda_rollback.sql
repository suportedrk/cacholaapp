-- supabase/migrations/138_manutencao_bloco_d_agenda_rollback.sql
-- Rollback da migration 138

BEGIN;

DROP INDEX IF EXISTS idx_mexec_responsible_scheduled;
DROP INDEX IF EXISTS idx_mexec_internal_scheduled;
DROP INDEX IF EXISTS idx_mexec_scheduled_at;

ALTER TABLE public.maintenance_executions
  DROP COLUMN IF EXISTS estimated_duration_minutes,
  DROP COLUMN IF EXISTS scheduled_at;

COMMIT;
