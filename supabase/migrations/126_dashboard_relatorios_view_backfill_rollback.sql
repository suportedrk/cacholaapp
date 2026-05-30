-- ============================================================
-- Rollback da Migration 126 — Dashboard + Relatórios backfill de .view
--
-- Reverte os dois backfills em user_permissions:
--   1) (module='dashboard', action='view', unit_id=NULL, granted=true)
--      dos usuários ATIVOS com role nos 8 cargos do dashboard.
--   2) (module='relatorios', action='view', unit_id=NULL, granted=true)
--      dos usuários ATIVOS com role=diretor.
--
-- ⚠ LIMITAÇÃO (igual aos rollbacks de backfill 113/116/122/124): não há
-- como distinguir com segurança as linhas INSERIDAS pela 126 das que já
-- existiam antes. Na auditoria de 2026-05-29 (produção):
--   - dashboard.view: 5 usuários receberam grants novos (gerente×1,
--     manutencao×1, pos_vendas×1, vendedora×2); diretor/rh já tinham.
--   - relatorios.view: INSERT foi no-op (os 2 diretores ativos —
--     carol/vinicius — já tinham via override). Este rollback removeria
--     TAMBÉM esses grants pré-existentes de diretor em relatorios.
-- Recomenda-se snapshot do banco antes de rodar em produção. Como os
-- guards das rotas ainda são por cargo nesta fase, remover esses grants é
-- comportamentalmente neutro até a Parte 2.
--
-- NÃO toca:
--   - grants de super_admin (bypassa de qualquer forma);
--   - overrides individuais de relatorios (gerente brunocasaletti@gmail
--     com 5 ações, gerente brunocasaletti@hotmail view, diretores
--     view+export) — são HONRADOS, este rollback só remove a ação 'view'
--     dos cargos-alvo, mas via DELETE por (module,action,role) atingiria
--     também o view dos diretores em relatorios; ver limitação acima;
--   - ações diferentes de 'view';
--   - role_permissions (template) — a 126 não o alterou.
--
-- NOTA: o DELETE de relatorios.view abaixo é restrito a role=diretor, então
-- NÃO remove o view de gerente brunocasaletti (override de gerente fica
-- intacto). Remove apenas o view dos diretores — que, em prod, são
-- justamente os overrides pré-existentes (limitação documentada).
--
-- Idempotente.
-- ============================================================

BEGIN;

-- 1) dashboard.view dos 8 cargos
DELETE FROM public.user_permissions up
USING public.users u
WHERE up.user_id = u.id
  AND up.module  = 'dashboard'
  AND up.action  = 'view'
  AND up.unit_id IS NULL
  AND up.granted = true
  AND u.is_active = true
  AND u.role IN (
    'diretor','gerente','financeiro','manutencao',
    'vendedora','pos_vendas','decoracao','rh'
  );

-- 2) relatorios.view de diretor
DELETE FROM public.user_permissions up
USING public.users u
WHERE up.user_id = u.id
  AND up.module  = 'relatorios'
  AND up.action  = 'view'
  AND up.unit_id IS NULL
  AND up.granted = true
  AND u.is_active = true
  AND u.role = 'diretor';

NOTIFY pgrst, 'reload schema';

COMMIT;
