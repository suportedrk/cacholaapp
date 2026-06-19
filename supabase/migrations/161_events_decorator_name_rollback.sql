-- Rollback da Migration 161 - remove decorator_name de events.
-- Sem BEGIN/COMMIT/ROLLBACK nem NOTIFY (padrao esteira).

ALTER TABLE public.events
  DROP COLUMN IF EXISTS decorator_name;
