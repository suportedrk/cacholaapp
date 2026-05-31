-- ============================================================
-- Rollback Migration 130 — Tema vira Receita
-- Remove o RPC e a tabela da receita. CASCADE limpa políticas,
-- índices e trigger junto.
-- ============================================================

BEGIN;

DROP FUNCTION IF EXISTS public.update_tema_receita(uuid, jsonb);

DROP TABLE IF EXISTS public.decoracao_tema_itens CASCADE;

NOTIFY pgrst, 'reload schema';

COMMIT;
