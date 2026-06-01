-- supabase/migrations/134_manutencao_bloco0_fundacao_rollback.sql
-- Rollback da migration 134_manutencao_bloco0_fundacao.sql

BEGIN;

-- 1. Reverter catálogo role_permissions
DELETE FROM public.role_permissions
WHERE (role_code = 'manutencao' AND module_code = 'manutencao' AND action IN ('create', 'edit'))
   OR (role_code = 'diretor'    AND module_code = 'manutencao' AND action = 'export');

-- 2. Restaurar trigger com comportamento original (changed_by = NEW.opened_by)
CREATE OR REPLACE FUNCTION public.record_ticket_status_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.maintenance_status_history
      (ticket_id, from_status, to_status, changed_by)
    VALUES
      (NEW.id, OLD.status, NEW.status, NEW.opened_by);
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Remover policy DELETE de maintenance_tickets
DROP POLICY IF EXISTS "maintenance_tickets: delete" ON public.maintenance_tickets;

COMMIT;
