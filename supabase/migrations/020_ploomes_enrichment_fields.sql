-- Migration 020: Ploomes enrichment fields for events table
-- Adds 22 new columns from Ploomes OtherProperties + deal.Amount
-- These are populated exclusively by the Ploomes sync — never by manual forms.
-- All columns are nullable (not all deals have all fields filled).

-- ── Logística ─────────────────────────────────────────────────
ALTER TABLE events ADD COLUMN IF NOT EXISTS setup_time    TIME;       -- Horário montagem
ALTER TABLE events ADD COLUMN IF NOT EXISTS teardown_time TIME;       -- Horário desmontagem
ALTER TABLE events ADD COLUMN IF NOT EXISTS show_time     TIME;       -- Horário show
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_location TEXT;      -- Local do evento (Select)
ALTER TABLE events ADD COLUMN IF NOT EXISTS duration      TIME;       -- Duração (campo Ploomes)

-- ── Serviços contratados ───────────────────────────────────────
ALTER TABLE events ADD COLUMN IF NOT EXISTS has_show              BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS photo_video           TEXT;    -- Select: tipo de cobertura
ALTER TABLE events ADD COLUMN IF NOT EXISTS decoration_aligned    BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS has_decorated_sweets  BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS party_favors          BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS outside_drinks        BOOLEAN DEFAULT FALSE;

-- ── Família/cliente ────────────────────────────────────────────
ALTER TABLE events ADD COLUMN IF NOT EXISTS father_name   TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS school        TEXT;       -- Select: escola do aniversariante
ALTER TABLE events ADD COLUMN IF NOT EXISTS birthday_date DATE;       -- Data de nascimento do aniversariante

-- ── Financeiro/operacional ─────────────────────────────────────
ALTER TABLE events ADD COLUMN IF NOT EXISTS payment_method  TEXT;    -- Select: forma de pagamento
ALTER TABLE events ADD COLUMN IF NOT EXISTS briefing        TEXT;    -- BigString: briefing inicial
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_category  TEXT;    -- Select: tipo social/corporativo
ALTER TABLE events ADD COLUMN IF NOT EXISTS cake_flavor     TEXT;    -- Select: sabor do bolo
ALTER TABLE events ADD COLUMN IF NOT EXISTS music           TEXT;    -- Select: músicas
ALTER TABLE events ADD COLUMN IF NOT EXISTS adult_count     INTEGER; -- Nº adultos
ALTER TABLE events ADD COLUMN IF NOT EXISTS kids_under4     INTEGER; -- Crianças ≤4 anos
ALTER TABLE events ADD COLUMN IF NOT EXISTS kids_over5      INTEGER; -- Crianças ≥5 anos

-- ── Financeiro: valor do negócio ─────────────────────────────
ALTER TABLE events ADD COLUMN IF NOT EXISTS deal_amount  DECIMAL(12,2); -- Deal.Amount do Ploomes
