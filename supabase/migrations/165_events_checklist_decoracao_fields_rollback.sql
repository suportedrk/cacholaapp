-- Rollback da Migration 165 - remove as 9 colunas do Checklist de Decoracao de events.
-- Sem BEGIN/COMMIT/ROLLBACK nem NOTIFY (padrao esteira).

ALTER TABLE public.events
  DROP COLUMN IF EXISTS decorator_notes,
  DROP COLUMN IF EXISTS forminhas_colors,
  DROP COLUMN IF EXISTS workshops_notes,
  DROP COLUMN IF EXISTS balloons_value,
  DROP COLUMN IF EXISTS balloons_notes,
  DROP COLUMN IF EXISTS fake_cake_value,
  DROP COLUMN IF EXISTS fake_cake_notes,
  DROP COLUMN IF EXISTS decorated_sweets_notes,
  DROP COLUMN IF EXISTS decoration_addons_notes;
