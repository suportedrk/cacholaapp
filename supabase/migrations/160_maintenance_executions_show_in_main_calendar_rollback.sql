-- Rollback da Migration 160 - remove o interruptor show_in_main_calendar.
-- Sem BEGIN/COMMIT/ROLLBACK nem NOTIFY (padrao esteira).

ALTER TABLE public.maintenance_executions
  DROP COLUMN IF EXISTS show_in_main_calendar;
