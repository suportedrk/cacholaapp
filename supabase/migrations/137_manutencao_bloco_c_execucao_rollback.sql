-- supabase/migrations/137_manutencao_bloco_c_execucao_rollback.sql
-- Rollback da migration 137

BEGIN;

-- 3. Restaura guard original (create-only) de get_maintenance_requester_options
CREATE OR REPLACE FUNCTION public.get_maintenance_requester_options(p_unit_id uuid DEFAULT NULL)
  RETURNS TABLE (id uuid, name text, role text)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF NOT check_permission(auth.uid(), 'manutencao', 'create') THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT u.id, u.name, u.role::text
  FROM public.users u
  WHERE u.is_active = true
    AND EXISTS (
      SELECT 1 FROM public.user_units uu
      WHERE uu.user_id = u.id
        AND (is_global_viewer() OR uu.unit_id = ANY (get_user_unit_ids()))
        AND (p_unit_id IS NULL OR uu.unit_id = p_unit_id)
    )
  ORDER BY u.name;
END;
$$;

-- 2. Remove RPC executor
DROP FUNCTION IF EXISTS public.get_maintenance_executor_options(uuid);

-- 1. Remove coluna + índice
DROP INDEX IF EXISTS idx_mexec_responsible;
ALTER TABLE public.maintenance_executions DROP COLUMN IF EXISTS responsible_user_id;

COMMIT;
