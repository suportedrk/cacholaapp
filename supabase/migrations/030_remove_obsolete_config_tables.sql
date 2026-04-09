-- Migration 030: Remove tabelas de configuracao obsoletas
-- Motivo: event_types, packages e venues eram cadastros manuais
-- que foram substituidos pela integracao com o Ploomes CRM.
-- Todas as tabelas estavam 100% vazias. FKs em events nunca foram preenchidas.

-- 1. Remover FKs da tabela events
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_event_type_id_fkey,
  DROP CONSTRAINT IF EXISTS events_package_id_fkey,
  DROP CONSTRAINT IF EXISTS events_venue_id_fkey;

-- 2. Remover colunas FK da tabela events
ALTER TABLE public.events
  DROP COLUMN IF EXISTS event_type_id,
  DROP COLUMN IF EXISTS package_id,
  DROP COLUMN IF EXISTS venue_id;

-- 3. Dropar as tabelas obsoletas
DROP TABLE IF EXISTS public.event_types CASCADE;
DROP TABLE IF EXISTS public.packages CASCADE;
DROP TABLE IF EXISTS public.venues CASCADE;
