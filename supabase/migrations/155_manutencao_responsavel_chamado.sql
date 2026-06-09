-- supabase/migrations/155_manutencao_responsavel_chamado.sql
-- Responsável pelo chamado — dono/gestor da ordem de manutenção.
--
-- Novo papel "Responsável pelo chamado": o colaborador encarregado de conduzir/gerir
-- o chamado de ponta a ponta. É DISTINTO dos três papéis já existentes:
--   - opened_by             → solicitante (quem pediu o reparo; selecionável na UI)
--   - created_by_user_id    → criador REAL (auth.uid() forçado por trigger, migration 136)
--   - maintenance_executions → executor (quem efetivamente faz o serviço, interno/externo)
--
-- Coluna NULLABLE: chamado pode ficar sem responsável até a triagem. Designar o
-- responsável é uma EDIÇÃO do chamado — já coberta pela permissão manutencao 'edit'
-- (UPDATE do ticket é gated por check_permission + escopo de unidade na RLS existente).
-- Por isso NÃO há alteração de RLS nesta migration.
--
-- O seletor de candidatos REUTILIZA a RPC get_maintenance_executor_options (migration
-- 137): equipe de manutenção da unidade (check_permission view), gated por manutencao
-- 'edit'. População e gate idênticos ao que faz sentido para um "dono/gestor" do
-- chamado — nenhuma RPC nova é necessária.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- assigned_to_user_id — Responsável pelo chamado (dono/gestor)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.maintenance_tickets
  ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid REFERENCES public.users(id);

CREATE INDEX IF NOT EXISTS idx_mtickets_assigned_to
  ON public.maintenance_tickets (assigned_to_user_id)
  WHERE assigned_to_user_id IS NOT NULL;

COMMENT ON COLUMN public.maintenance_tickets.assigned_to_user_id IS
  'Responsável pelo chamado (dono/gestor que conduz a ordem). Distinto de opened_by (solicitante), created_by_user_id (criador real via trigger) e do executor em maintenance_executions. Nullable: pode ser designado na abertura ou depois na triagem. Designar = edição do chamado (permissão manutencao edit).';

COMMIT;
