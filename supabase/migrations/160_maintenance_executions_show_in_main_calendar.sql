-- Migration 160 - Interruptor "mostrar no calendario principal" por execucao de manutencao.
-- PRIMEIRA migracao aplicada pela esteira (GitHub Actions). NAO inclui BEGIN/COMMIT/ROLLBACK
-- nem NOTIFY pgrst: a esteira gerencia a transacao (--single-transaction) e recarrega o schema.
--
-- Adiciona show_in_main_calendar em maintenance_executions. Default false = opt-in:
-- a execucao agendada so aparece no calendario principal (Inicio) se o responsavel marcar.
-- Nao altera RLS: e um atributo da execucao, coberto pelas policies existentes
-- (manutencao create/edit). Sem indice: tabela de baixo volume, coluna booleana.

ALTER TABLE public.maintenance_executions
  ADD COLUMN IF NOT EXISTS show_in_main_calendar boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.maintenance_executions.show_in_main_calendar IS
  'Quando true, a execucao agendada aparece no calendario principal (dashboard/Inicio). Default false = opt-in pelo responsavel. Introduzida na migration 160 (primeira via esteira).';
