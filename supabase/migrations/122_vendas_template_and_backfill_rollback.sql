-- ============================================================
-- Rollback da Migration 122 — Vendas template + backfill de vendas.view
--
-- Reverte o PASSO 2 (backfill em user_permissions): remove as linhas
-- (module='vendas', action='view', unit_id=NULL, granted=true) dos
-- usuários ativos cujo role é diretor/vendedora/pos_vendas.
--
-- ⚠ LIMITAÇÃO (igual aos rollbacks de backfill 113/116): não há como
-- distinguir com segurança as linhas INSERIDAS pela 122 das que já
-- existiam antes (na auditoria de 2026-05-29, 2 diretores e 1 pos_vendas
-- em produção JÁ tinham vendas.view). Este rollback remove TODAS as
-- linhas vendas.view (unit_id NULL, granted=true) desses cargos —
-- inclusive eventuais pré-existentes. Recomenda-se snapshot do banco
-- antes de rodar em produção. Como os guards ainda são por cargo nesta
-- fase, remover esses grants é comportamentalmente neutro até a Parte 2.
--
-- O PASSO 1 (template role_permissions) NÃO é revertido: os grants
-- vendas.view já existiam antes da 122 (o INSERT foi no-op via
-- ON CONFLICT DO NOTHING), logo não há nada introduzido a remover.
--
-- NÃO toca grants de gerente (ex.: brunocasaletti@gmail.com), super_admin,
-- nem ações diferentes de 'view' — preserva qualquer override pré-existente.
--
-- Idempotente.
-- ============================================================

BEGIN;

DELETE FROM public.user_permissions up
USING public.users u
WHERE up.user_id = u.id
  AND up.module  = 'vendas'
  AND up.action  = 'view'
  AND up.unit_id IS NULL
  AND up.granted = true
  AND u.role IN ('diretor','vendedora','pos_vendas');

NOTIFY pgrst, 'reload schema';

COMMIT;
