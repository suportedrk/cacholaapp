-- supabase/migrations/138_manutencao_bloco_d_agenda.sql
-- Bloco D — Agenda e Tarefas.
--
-- Agenda a EXECUÇÃO (não o ticket): a execução é quem tem o designado
-- (internal_user_id / responsible_user_id) e a duração estimada. A agenda e a
-- lista de tarefas pessoais leem daqui.
--
-- maintenance_tickets.scheduled_date permanece INTOCADA (D2) — é vestigial/morta;
-- a fonte única da verdade da agenda é maintenance_executions.scheduled_at.

BEGIN;

ALTER TABLE public.maintenance_executions
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes integer;

-- Calendário: execuções agendadas numa janela de datas.
CREATE INDEX IF NOT EXISTS idx_mexec_scheduled_at
  ON public.maintenance_executions (scheduled_at)
  WHERE scheduled_at IS NOT NULL;

-- Lista pessoal: cada ramo do OR (executor / responsável) tem seu índice parcial.
CREATE INDEX IF NOT EXISTS idx_mexec_internal_scheduled
  ON public.maintenance_executions (internal_user_id, scheduled_at)
  WHERE scheduled_at IS NOT NULL AND internal_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mexec_responsible_scheduled
  ON public.maintenance_executions (responsible_user_id, scheduled_at)
  WHERE scheduled_at IS NOT NULL AND responsible_user_id IS NOT NULL;

COMMENT ON COLUMN public.maintenance_executions.scheduled_at IS
  'Data/hora agendada da execução — FONTE ÚNICA da agenda e da lista de tarefas do designado. NÃO usar maintenance_tickets.scheduled_date (vestigial/morta).';
COMMENT ON COLUMN public.maintenance_executions.estimated_duration_minutes IS
  'Duração estimada da execução em minutos.';

COMMIT;
