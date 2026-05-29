-- ============================================================
-- Rollback da Migration 124 — BI backfill de .view para diretor
--
-- Reverte o backfill em user_permissions: remove as linhas
-- (module IN bi/bi_atendimento/bi_vendas, action='view', unit_id=NULL,
-- granted=true) dos usuários ATIVOS cujo role é diretor.
--
-- ⚠ LIMITAÇÃO (igual aos rollbacks de backfill 113/116/122): não há como
-- distinguir com segurança as linhas INSERIDAS pela 124 das que já
-- existiam antes. Na auditoria de 2026-05-29 (produção), os 2 diretores
-- ativos JÁ tinham os 3 .view — o INSERT da 124 foi no-op para eles via
-- ON CONFLICT DO NOTHING. Este rollback removeria TAMBÉM esses grants
-- pré-existentes. Recomenda-se snapshot do banco antes de rodar em
-- produção. Como os guards do BI ainda são por cargo nesta fase, remover
-- esses grants é comportamentalmente neutro até a Parte 2.
--
-- NÃO toca:
--   - grants de gerente (ex.: brunocasaletti@gmail.com — override de prod
--     a tratar na Parte 2), financeiro, super_admin;
--   - ações diferentes de 'view';
--   - role_permissions (template) — a 124 não o alterou.
--
-- Idempotente.
-- ============================================================

BEGIN;

DELETE FROM public.user_permissions up
USING public.users u
WHERE up.user_id = u.id
  AND up.module  IN ('bi','bi_atendimento','bi_vendas')
  AND up.action  = 'view'
  AND up.unit_id IS NULL
  AND up.granted = true
  AND u.role = 'diretor';

NOTIFY pgrst, 'reload schema';

COMMIT;
