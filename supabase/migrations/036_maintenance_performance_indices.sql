-- Migration 036: Performance indices for maintenance module tables
-- Tables: maintenance_tickets, maintenance_executions,
--         maintenance_ticket_photos, maintenance_status_history,
--         maintenance_sectors, maintenance_categories, maintenance_items

-- ─── maintenance_tickets ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mtickets_unit_id
  ON public.maintenance_tickets(unit_id);

CREATE INDEX IF NOT EXISTS idx_mtickets_unit_status
  ON public.maintenance_tickets(unit_id, status);

CREATE INDEX IF NOT EXISTS idx_mtickets_status
  ON public.maintenance_tickets(status);

CREATE INDEX IF NOT EXISTS idx_mtickets_urgency
  ON public.maintenance_tickets(urgency);

CREATE INDEX IF NOT EXISTS idx_mtickets_nature
  ON public.maintenance_tickets(nature);

CREATE INDEX IF NOT EXISTS idx_mtickets_sector_id
  ON public.maintenance_tickets(sector_id);

CREATE INDEX IF NOT EXISTS idx_mtickets_opened_by
  ON public.maintenance_tickets(opened_by);

CREATE INDEX IF NOT EXISTS idx_mtickets_created_at
  ON public.maintenance_tickets(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mtickets_due_at
  ON public.maintenance_tickets(due_at)
  WHERE due_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mtickets_concluded_at
  ON public.maintenance_tickets(concluded_at DESC)
  WHERE concluded_at IS NOT NULL;

-- ─── maintenance_executions ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mexecutions_ticket_id
  ON public.maintenance_executions(ticket_id);

CREATE INDEX IF NOT EXISTS idx_mexecutions_provider_id
  ON public.maintenance_executions(provider_id)
  WHERE provider_id IS NOT NULL;

-- ─── maintenance_ticket_photos ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mticket_photos_ticket_id
  ON public.maintenance_ticket_photos(ticket_id);

-- ─── maintenance_status_history ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mstatus_history_ticket_id
  ON public.maintenance_status_history(ticket_id);

-- ─── maintenance_sectors ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_msectors_unit_id
  ON public.maintenance_sectors(unit_id);

-- ─── maintenance_categories ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mcategories_unit_id
  ON public.maintenance_categories(unit_id);

-- ─── maintenance_items ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mitems_unit_id
  ON public.maintenance_items(unit_id);

CREATE INDEX IF NOT EXISTS idx_mitems_sector_id
  ON public.maintenance_items(sector_id)
  WHERE sector_id IS NOT NULL;
