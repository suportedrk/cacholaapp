-- Migration 019: Add client_phone, client_email, theme to events table
-- These fields are already parsed from Ploomes OtherProperties but were not being stored.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS client_phone TEXT,
  ADD COLUMN IF NOT EXISTS client_email TEXT,
  ADD COLUMN IF NOT EXISTS theme        TEXT;

-- Index para busca por tema
CREATE INDEX IF NOT EXISTS idx_events_theme ON events(theme) WHERE theme IS NOT NULL;

COMMENT ON COLUMN events.client_phone IS 'Telefone do contratante (sync do Ploomes Contact)';
COMMENT ON COLUMN events.client_email IS 'E-mail do contratante (sync do Ploomes Contact)';
COMMENT ON COLUMN events.theme        IS 'Tema da festa (sync do campo customizado Ploomes)';
