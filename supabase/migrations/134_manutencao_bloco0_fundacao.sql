-- supabase/migrations/134_manutencao_bloco0_fundacao.sql
-- Bloco 0 da reforma do módulo Manutenção: fundação RBAC e correções de base.
--
-- Cobre três ajustes independentes:
--   1. Catálogo role_permissions: adiciona create+edit para 'manutencao'
--      e export para 'diretor' (alinha catálogo com a realidade de user_permissions).
--   2. Trigger record_ticket_status_change: corrige changed_by de NEW.opened_by
--      para auth.uid() (quem realmente alterou o status).
--   3. RLS maintenance_tickets: adiciona a policy DELETE faltante, seguindo
--      o mesmo padrão das demais tabelas do módulo.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CATÁLOGO role_permissions — manutencao + diretor
-- ─────────────────────────────────────────────────────────────────────────────

-- Role 'manutencao': adicionar create e edit (catálogo estava só com view;
-- user_permissions já tinha view+create+edit — nenhum backfill necessário).
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('manutencao', 'manutencao', 'create', true),
  ('manutencao', 'manutencao', 'edit',   true)
ON CONFLICT (role_code, module_code, action)
  DO UPDATE SET granted = EXCLUDED.granted, updated_at = now();

-- Role 'diretor': adicionar export (todos os diretores já têm em user_permissions;
-- alinha o catálogo para que novos diretores recebam export ao aplicar template).
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('diretor', 'manutencao', 'export', true)
ON CONFLICT (role_code, module_code, action)
  DO UPDATE SET granted = EXCLUDED.granted, updated_at = now();

-- Nota: 'gerente' não recebe export no catálogo propositalmente — apenas 1 de 2
-- gerentes tem o grant individual, e applyRoleTemplate é UPSERT puro (sem deleção),
-- portanto o grant existente sobrevive sem intervenção.

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TRIGGER record_ticket_status_change — corrigir changed_by
-- ─────────────────────────────────────────────────────────────────────────────
-- Antes: gravava NEW.opened_by (quem abriu o chamado).
-- Depois: grava auth.uid() (quem está executando a mudança de status).
-- A assinatura da função não muda; CREATE OR REPLACE é suficiente.

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
      (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS maintenance_tickets — policy DELETE faltante
-- ─────────────────────────────────────────────────────────────────────────────
-- Todas as outras tabelas do módulo tinham SELECT/INSERT/UPDATE/DELETE.
-- maintenance_tickets só tinha SELECT/INSERT/UPDATE — corrige aqui.
-- Padrão idêntico ao das demais tabelas: check_permission + escopo de unidade.

CREATE POLICY "maintenance_tickets: delete"
  ON public.maintenance_tickets
  FOR DELETE
  USING (
    check_permission(auth.uid(), 'manutencao'::text, 'delete'::text)
    AND (is_global_viewer() OR (unit_id = ANY (get_user_unit_ids())))
  );

COMMIT;
