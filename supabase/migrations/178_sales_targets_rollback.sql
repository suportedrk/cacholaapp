-- ============================================================
-- Rollback da Migration 178 — Metas de Vendas
--
-- Remove a RPC e a tabela (CASCADE leva policies/índices/trigger).
--
-- NÃO reverte o backfill de vendas:edit (Parte 4): o diretor já tinha
-- vendas:edit no template (mig 071) e via applyRoleTemplate ANTES desta
-- migration — o backfill foi idempotente (ON CONFLICT). Apagar essas
-- linhas no rollback removeria um grant legítimo e pré-existente. O grant
-- é benigno (não destrava nada além de gerir metas, cuja tabela some aqui).
-- ============================================================

DROP FUNCTION IF EXISTS public.get_sales_target_for_period(uuid, date, date);

DROP TABLE IF EXISTS public.sales_targets CASCADE;
