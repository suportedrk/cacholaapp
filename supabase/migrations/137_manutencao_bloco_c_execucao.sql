-- supabase/migrations/137_manutencao_bloco_c_execucao.sql
-- Bloco C — Execução do chamado.
--
--   1. Coluna responsible_user_id em maintenance_executions: colaborador interno
--      que acompanha um serviço EXTERNO (executor_type='external').
--   2. RPC get_maintenance_executor_options: lista a EQUIPE DE MANUTENÇÃO
--      (usuários ativos com check_permission(view) no módulo) da unidade — para o
--      seletor de executor interno. SECURITY DEFINER + guard manutencao 'edit'.
--   3. Amplia o guard de get_maintenance_requester_options (create → create OR edit)
--      para que o reuso no seletor de "Responsável interno" (contexto de edição)
--      seja correto por construção, sem depender de o cargo ter 'create'.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. responsible_user_id
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.maintenance_executions
  ADD COLUMN IF NOT EXISTS responsible_user_id uuid REFERENCES public.users(id);

CREATE INDEX IF NOT EXISTS idx_mexec_responsible
  ON public.maintenance_executions (responsible_user_id)
  WHERE responsible_user_id IS NOT NULL;

COMMENT ON COLUMN public.maintenance_executions.responsible_user_id IS
  'Colaborador interno que acompanha o serviço externo (executor_type=external).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RPC executor interno — equipe de manutenção (check_permission view)
-- ─────────────────────────────────────────────────────────────────────────────
-- Diferença vs requester: filtra só quem tem ACESSO AO MÓDULO de manutenção
-- (check_permission(u.id,'manutencao','view') = true) — a "equipe apta a executar".
CREATE OR REPLACE FUNCTION public.get_maintenance_executor_options(p_unit_id uuid DEFAULT NULL)
  RETURNS TABLE (id uuid, name text, role text)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  -- Atribuir/editar execução = editar o chamado.
  IF NOT check_permission(auth.uid(), 'manutencao', 'edit') THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT u.id, u.name, u.role::text
  FROM public.users u
  WHERE u.is_active = true
    AND check_permission(u.id, 'manutencao', 'view')
    AND EXISTS (
      SELECT 1 FROM public.user_units uu
      WHERE uu.user_id = u.id
        AND (is_global_viewer() OR uu.unit_id = ANY (get_user_unit_ids()))
        AND (p_unit_id IS NULL OR uu.unit_id = p_unit_id)
    )
  ORDER BY u.name;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Amplia guard de get_maintenance_requester_options (create OR edit)
-- ─────────────────────────────────────────────────────────────────────────────
-- Assinatura idêntica → CREATE OR REPLACE (sem DROP). Corpo preservado da
-- migration 136, só o guard muda.
CREATE OR REPLACE FUNCTION public.get_maintenance_requester_options(p_unit_id uuid DEFAULT NULL)
  RETURNS TABLE (id uuid, name text, role text)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF NOT (check_permission(auth.uid(), 'manutencao', 'create')
          OR check_permission(auth.uid(), 'manutencao', 'edit')) THEN
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

COMMIT;
