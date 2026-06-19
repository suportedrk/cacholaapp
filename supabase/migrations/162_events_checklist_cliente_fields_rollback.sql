-- Rollback da Migration 162 - remove as 9 colunas do Checklist do Cliente de events.
-- Sem BEGIN/COMMIT/ROLLBACK nem NOTIFY (padrao esteira).

ALTER TABLE public.events
  DROP COLUMN IF EXISTS corkage_quantity,
  DROP COLUMN IF EXISTS extra_guest_staff_value,
  DROP COLUMN IF EXISTS responsible_person,
  DROP COLUMN IF EXISTS photo_video_contact,
  DROP COLUMN IF EXISTS generator,
  DROP COLUMN IF EXISTS valet_cost,
  DROP COLUMN IF EXISTS checklist_other_details,
  DROP COLUMN IF EXISTS corkage_paid,
  DROP COLUMN IF EXISTS overtime_details;
