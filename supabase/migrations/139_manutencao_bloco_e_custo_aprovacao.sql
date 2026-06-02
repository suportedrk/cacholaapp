-- supabase/migrations/139_manutencao_bloco_e_custo_aprovacao.sql
-- Bloco E — Custo e Aprovação.
--
--   1. Ação de permissão 'approve' no módulo manutencao (catálogo + grants +
--      backfill). Autoridade de aprovação passa a ser PERMISSION-BASED
--      (check_permission), não cargo hardcodado.
--   2. approved_cost (valor aprovado, pode diferir do estimado = cost).
--   3. update_ticket_total_cost passa a somar COALESCE(approved_cost, cost);
--      trigger recriado para também disparar em UPDATE OF approved_cost.
--   4. guard_cost_approval (da migration 095) recriado: troca o role IN (...)
--      hardcodado por check_permission('manutencao','approve') e passa a cobrir
--      também approved_cost (anti-spoofing).
--   5. RPC approve_execution_cost: grava o valor aprovado + quem + quando,
--      gated por check_permission('manutencao','approve').

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Ação 'approve' — catálogo, template e backfill
-- ─────────────────────────────────────────────────────────────────────────────
-- permission_controls é o pai das FKs de role_permissions/user_permissions.
INSERT INTO public.permission_controls (module_code, code, label, description, kind, sort_order)
VALUES ('manutencao', 'approve', 'Aprovar', 'Aprovação de custo de execução.', 'action', 60)
ON CONFLICT (module_code, code) DO NOTHING;

-- Template (catálogo): gestores aprovam; manutencao NÃO.
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('super_admin', 'manutencao', 'approve', true),
  ('diretor',     'manutencao', 'approve', true),
  ('gerente',     'manutencao', 'approve', true)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = EXCLUDED.granted;

-- Backfill runtime: diretor/gerente ativos recebem o grant em user_permissions.
-- super_admin bypassa check_permission (early return) — não precisa de linha.
INSERT INTO public.user_permissions (user_id, unit_id, module, action, granted)
SELECT u.id, NULL, 'manutencao', 'approve', true
FROM public.users u
WHERE u.role IN ('diretor', 'gerente') AND u.is_active = true
ON CONFLICT (user_id, unit_id, module, action) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. approved_cost
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.maintenance_executions
  ADD COLUMN IF NOT EXISTS approved_cost numeric;

COMMENT ON COLUMN public.maintenance_executions.cost IS
  'Valor ESTIMADO da execução (lançado por quem registra a execução).';
COMMENT ON COLUMN public.maintenance_executions.approved_cost IS
  'Valor APROVADO pelo gestor (pode diferir do estimado). NULL até aprovação.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Total do chamado = SUM(COALESCE(approved_cost, cost))
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_ticket_total_cost()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.maintenance_tickets
  SET total_cost = (
    SELECT COALESCE(SUM(COALESCE(approved_cost, cost)), 0)
    FROM public.maintenance_executions
    WHERE ticket_id = COALESCE(NEW.ticket_id, OLD.ticket_id)
  )
  WHERE id = COALESCE(NEW.ticket_id, OLD.ticket_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recria o trigger para também disparar quando approved_cost muda.
DROP TRIGGER IF EXISTS sync_ticket_total_cost ON public.maintenance_executions;
CREATE TRIGGER sync_ticket_total_cost
  AFTER INSERT OR DELETE OR UPDATE OF cost, approved_cost ON public.maintenance_executions
  FOR EACH ROW EXECUTE FUNCTION public.update_ticket_total_cost();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. guard_cost_approval — permission-based (substitui o role IN da migration 095)
-- ─────────────────────────────────────────────────────────────────────────────
-- Rejeita qualquer alteração nos campos de aprovação (incl. approved_cost) por
-- quem não tem check_permission('manutencao','approve'). À prova de bypass:
-- mesmo UPDATE direto é barrado.
CREATE OR REPLACE FUNCTION public.guard_cost_approval()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF (NEW.cost_approved, NEW.approved_cost, NEW.cost_approved_by, NEW.cost_approved_at)
     IS DISTINCT FROM
     (OLD.cost_approved, OLD.approved_cost, OLD.cost_approved_by, OLD.cost_approved_at)
  THEN
    IF NOT check_permission(auth.uid(), 'manutencao', 'approve') THEN
      RAISE EXCEPTION
        'permissao_negada: aprovacao de custo exige permissao manutencao.approve'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
-- Trigger trg_guard_cost_approval (migration 095) já aponta para esta função;
-- CREATE OR REPLACE acima já o atualiza. Sem recriar o trigger.

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RPC approve_execution_cost — aprovação atômica gated por permissão
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_execution_cost(p_execution_id uuid, p_approved_cost numeric)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF NOT check_permission(auth.uid(), 'manutencao', 'approve') THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  UPDATE public.maintenance_executions
  SET approved_cost     = p_approved_cost,
      cost_approved     = true,
      cost_approved_by  = auth.uid(),
      cost_approved_at  = now()
  WHERE id = p_execution_id;
END;
$$;

COMMIT;
