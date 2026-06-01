-- supabase/migrations/136_manutencao_bloco_b_nature_e_created_by_rollback.sql
-- Rollback da migration 136

BEGIN;

-- 3. Remover RPC
DROP FUNCTION IF EXISTS public.get_maintenance_requester_options(uuid);

-- 2. Remover trigger + função + coluna
DROP TRIGGER IF EXISTS trg_set_ticket_created_by ON public.maintenance_tickets;
DROP FUNCTION IF EXISTS public.set_ticket_created_by();
DROP INDEX IF EXISTS idx_mtickets_created_by;
ALTER TABLE public.maintenance_tickets DROP COLUMN IF EXISTS created_by_user_id;

-- 1. Restaurar constraint e default originais de nature
ALTER TABLE public.maintenance_tickets
  DROP CONSTRAINT maintenance_tickets_nature_check;
ALTER TABLE public.maintenance_tickets
  ADD CONSTRAINT maintenance_tickets_nature_check
  CHECK (nature = ANY (ARRAY['emergencial', 'pontual', 'agendado', 'preventivo']));
ALTER TABLE public.maintenance_tickets
  ALTER COLUMN nature SET DEFAULT 'pontual';

COMMIT;
