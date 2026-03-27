-- ============================================================
-- Cachola OS — Migration 006: Atualização da Tabela Events (Fase 1)
-- ============================================================
-- 1. Atualiza enum de status (draft→pending, completed→finished,
--    remove cancelled, adiciona preparing e post_event)
-- 2. Substitui colunas TEXT (event_type, package, venue) por FKs UUID
-- Execute com:
--   docker exec cacholaos-db bash -c "psql -U postgres -d postgres -f /docker-entrypoint-migrations/006_fase1_events_update.sql"
-- ============================================================

-- ============================================================
-- STEP 1: Atualizar status CHECK constraint
-- ============================================================

-- Remover constraint antiga
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_status_check;

-- Migrar dados existentes (banco vazio em dev, mas boa prática)
UPDATE public.events SET status = 'pending'  WHERE status = 'draft';
UPDATE public.events SET status = 'finished' WHERE status = 'completed';
-- Eventos cancelados ficam como 'finished' (não há equivalente no novo enum)
UPDATE public.events SET status = 'finished' WHERE status = 'cancelled';

-- Adicionar nova constraint
ALTER TABLE public.events
  ADD CONSTRAINT events_status_check
  CHECK (status IN ('pending', 'confirmed', 'preparing', 'in_progress', 'finished', 'post_event'));

-- Atualizar default
ALTER TABLE public.events
  ALTER COLUMN status SET DEFAULT 'pending';

-- ============================================================
-- STEP 2: Substituir colunas TEXT por FKs UUID
-- ============================================================

-- Adicionar novas colunas FK (nullable — existentes em STEP 3 ficam NULL)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_type_id UUID REFERENCES public.event_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS package_id    UUID REFERENCES public.packages(id)     ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS venue_id      UUID REFERENCES public.venues(id)       ON DELETE SET NULL;

-- Remover colunas TEXT antigas
ALTER TABLE public.events
  DROP COLUMN IF EXISTS event_type,
  DROP COLUMN IF EXISTS package,
  DROP COLUMN IF EXISTS venue;

-- Índices nas novas FKs
CREATE INDEX IF NOT EXISTS idx_events_event_type_id ON public.events(event_type_id);
CREATE INDEX IF NOT EXISTS idx_events_package_id    ON public.events(package_id);
CREATE INDEX IF NOT EXISTS idx_events_venue_id      ON public.events(venue_id);
