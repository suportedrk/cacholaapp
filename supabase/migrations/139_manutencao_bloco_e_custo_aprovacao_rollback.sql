-- supabase/migrations/139_manutencao_bloco_e_custo_aprovacao_rollback.sql
-- Rollback da migration 139

BEGIN;

-- 5. Remove RPC
DROP FUNCTION IF EXISTS public.approve_execution_cost(uuid, numeric);

-- 4. Restaura guard_cost_approval da migration 095 (role IN hardcodado, 3 campos)
CREATE OR REPLACE FUNCTION public.guard_cost_approval()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF (NEW.cost_approved, NEW.cost_approved_by, NEW.cost_approved_at)
     IS DISTINCT FROM
     (OLD.cost_approved, OLD.cost_approved_by, OLD.cost_approved_at)
  THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'diretor', 'gerente')
    ) THEN
      RAISE EXCEPTION
        'permissao_negada: aprovacao de custo restrita a super_admin, diretor ou gerente'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Restaura total = SUM(cost) e trigger original (só OF cost)
CREATE OR REPLACE FUNCTION public.update_ticket_total_cost()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.maintenance_tickets
  SET total_cost = (
    SELECT COALESCE(SUM(cost), 0)
    FROM public.maintenance_executions
    WHERE ticket_id = COALESCE(NEW.ticket_id, OLD.ticket_id)
  )
  WHERE id = COALESCE(NEW.ticket_id, OLD.ticket_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS sync_ticket_total_cost ON public.maintenance_executions;
CREATE TRIGGER sync_ticket_total_cost
  AFTER INSERT OR DELETE OR UPDATE OF cost ON public.maintenance_executions
  FOR EACH ROW EXECUTE FUNCTION public.update_ticket_total_cost();

-- 2. Remove coluna
ALTER TABLE public.maintenance_executions DROP COLUMN IF EXISTS approved_cost;

-- 1. Remove grants e a ação do catálogo (ordem: filhos antes do pai)
DELETE FROM public.user_permissions WHERE module = 'manutencao' AND action = 'approve';
DELETE FROM public.role_permissions WHERE module_code = 'manutencao' AND action = 'approve';
DELETE FROM public.permission_controls WHERE module_code = 'manutencao' AND code = 'approve';

COMMIT;
