-- ============================================================
-- Cachola OS — Migration 016: Adicionar status 'lost' em events
-- ============================================================
-- Deals "Perdido" no Ploomes geram eventos com status 'lost'
-- (mantidos para estatísticas, ocultos por padrão na UI).
--
-- Também adiciona coluna deals_removed ao ploomes_sync_log
-- para rastrear quantos deals mudaram para 'lost' na sync.
-- ============================================================
-- Execute com:
--   docker exec cacholaos-db bash -c "psql -U postgres -d postgres -f /docker-entrypoint-migrations/016_events_status_lost.sql"
-- ============================================================

-- ── 1. Atualizar CHECK constraint de events.status ────────────

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_status_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_status_check
  CHECK (status IN (
    'pending',
    'confirmed',
    'preparing',
    'in_progress',
    'finished',
    'post_event',
    'lost'
  ));

-- ── 2. Adicionar deals_removed ao ploomes_sync_log ────────────

ALTER TABLE public.ploomes_sync_log
  ADD COLUMN IF NOT EXISTS deals_removed INTEGER NOT NULL DEFAULT 0;
