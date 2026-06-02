-- supabase/migrations/140_manutencao_bloco_f_finalizacao_rollback.sql
-- Rollback da migration 140

BEGIN;

-- 3. Remove trigger + função de carimbo
DROP TRIGGER IF EXISTS trg_set_concluded_by ON public.maintenance_tickets;
DROP FUNCTION IF EXISTS public.set_ticket_concluded_by();

-- 2. Remove phase das fotos
ALTER TABLE public.maintenance_ticket_photos DROP COLUMN IF EXISTS phase;

-- 1. Remove colunas do ticket
ALTER TABLE public.maintenance_tickets
  DROP COLUMN IF EXISTS concluded_by_user_id,
  DROP COLUMN IF EXISTS resolution_notes;

COMMIT;
