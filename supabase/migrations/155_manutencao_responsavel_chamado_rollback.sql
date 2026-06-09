-- supabase/migrations/155_manutencao_responsavel_chamado_rollback.sql
-- Rollback da migration 155 — remove o "Responsável pelo chamado".
--
-- Remove o índice parcial e a coluna assigned_to_user_id de maintenance_tickets.
-- Nenhuma RPC nova foi criada na 155 (reuso de get_maintenance_executor_options),
-- portanto nada a reverter no lado de funções. Sem alteração de RLS para reverter.

BEGIN;

DROP INDEX IF EXISTS public.idx_mtickets_assigned_to;

ALTER TABLE public.maintenance_tickets
  DROP COLUMN IF EXISTS assigned_to_user_id;

COMMIT;
