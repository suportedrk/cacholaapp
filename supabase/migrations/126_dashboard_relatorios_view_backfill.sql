-- ============================================================
-- Migration 126 — Dashboard + Relatórios: backfill de
--                  dashboard.view + relatorios.view (Fase 3, D+R Parte 1)
-- Criado em: 2026-05-29
-- Referência: docs/rbac/fase-a-dashboard-relatorios.md (§5 backfill,
--             Aprendizado 1) + estrutura das migrations 122/124
--
-- NEUTRA EM COMPORTAMENTO. Esta migration só CRIA grants `.view` em
-- user_permissions. Os guards das rotas continuam por CARGO (role IN):
--   - /dashboard → requireRoleServer(DASHBOARD_ACCESS_ROLES)
--   - /relatorios → requireRoleServer(BI_ACCESS_ROLES)
-- ...até a Parte 2. Portanto NADA muda para o usuário agora. O objetivo
-- é garantir os grants ANTES da troca de trava (Parte 2), evitando
-- lockout — em especial na LANDING PAGE /dashboard, que serve 9 cargos
-- (Aprendizado 1).
--
-- ── DECISÕES DO DONO APLICADAS (FASE A) ───────────────────────
--   (i)  dashboard → dashboard.view. Backfill dos 8 cargos de
--        DASHBOARD_ACCESS_ROLES EXCETO super_admin (que bypassa):
--        diretor, gerente, financeiro, manutencao, vendedora,
--        pos_vendas, decoracao, rh. freelancer/entregador ficam FORA
--        (não têm dashboard — redirecionados pós-login).
--   (ii) relatorios → relatorios.view (módulo PRÓPRIO, não bi).
--        Backfill apenas de diretor (super_admin bypassa).
--   (iii) HONRAR os overrides individuais dormentes de relatorios — esta
--        migration NÃO os toca (financeiro/gerente/diretor já existentes).
--        NÃO estende a classe ger/fin ao template (NÃO expandir).
--   (iv) export = status quo (client-side, sem gate). Só 'view' aqui.
--
-- ── ESCOPO ────────────────────────────────────────────────────
--   Backfill 1 (user_permissions): para todo usuário ATIVO com role nos
--   8 cargos do dashboard, cria (user_id,'dashboard','view',true,NULL).
--   Backfill 2 (user_permissions): para todo usuário ATIVO com
--   role=diretor, cria (user_id,'relatorios','view',true,NULL).
--   Ambos ON CONFLICT DO NOTHING.
--
-- ── EXCLUSÕES DELIBERADAS ─────────────────────────────────────
--   - super_admin: bypass em check_permission() (early-return) — sem grant.
--   - freelancer / entregador: NÃO têm dashboard; fora.
--   - relatorios: gerente/financeiro NÃO recebem backfill de classe — seus
--     acessos vêm dos overrides individuais, honrados e intocados.
--   - Apenas a ação 'view'. create/edit/delete/export NÃO são backfilladas.
--   - role_permissions (template) NÃO é tocado: já está alinhado
--     (auditoria 2026-05-29 prod: dashboard.view = 9 cargos;
--     relatorios.view = sa+diretor).
--
-- ── role_default_perms (legado) NÃO É TOCADO ──────────────────
--   Herança de novos usuários vem de role_permissions
--   (src/lib/rbac/apply-template.ts). Padrão das migrations 113/116/122/124.
--
-- ── ESTADO DE PRODUÇÃO RELEVANTE PARA A PARTE 2 (NÃO tratado aqui) ──
--   Overrides de relatorios em prod (a HONRAR na Parte 2, conforme dono):
--     diretor carol/vinicius: view+export
--     gerente brunocasaletti@gmail.com: TODAS as 5 ações (override amplo)
--     gerente brunocasaletti@hotmail.com: view
--   (Não há usuário financeiro ativo em prod.) Diferente do BI, onde o
--   override de brunocasaletti@gmail foi LIMPO — aqui o dono decidiu HONRAR.
--   Esta Parte 1 não mexe em nenhum desses grants.
--
-- Idempotente. Não-destrutivo.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Pré-condição: catálogo tem a ação 'view' nos 2 módulos
-- ------------------------------------------------------------
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.permission_controls
  WHERE module_code IN ('dashboard','relatorios')
    AND code = 'view'
    AND kind = 'action';

  IF v_count <> 2 THEN
    RAISE EXCEPTION
      'Abortando: esperava 2 ações view (dashboard/relatorios) em permission_controls, encontrei %. Catálogo RBAC precisa estar aplicado.',
      v_count;
  END IF;

  RAISE NOTICE 'OK: catálogo dashboard.view + relatorios.view confirmado.';
END
$$;

-- ------------------------------------------------------------
-- Log: estado antes do backfill
-- ------------------------------------------------------------
DO $$
DECLARE
  v_dash INT;
  v_rel  INT;
BEGIN
  SELECT COUNT(*) INTO v_dash
  FROM public.user_permissions WHERE module = 'dashboard' AND action = 'view';
  SELECT COUNT(*) INTO v_rel
  FROM public.user_permissions WHERE module = 'relatorios' AND action = 'view';
  RAISE NOTICE 'user_permissions dashboard.view antes: % | relatorios.view antes: %', v_dash, v_rel;
END
$$;

-- ------------------------------------------------------------
-- Backfill 1: dashboard.view para os 8 cargos ativos (unit_id NULL)
-- super_admin bypass; freelancer/entregador fora; só 'view'.
-- ------------------------------------------------------------
INSERT INTO public.user_permissions (user_id, unit_id, module, action, granted)
SELECT
  u.id        AS user_id,
  NULL::UUID  AS unit_id,
  'dashboard' AS module,
  'view'      AS action,
  true        AS granted
FROM public.users u
WHERE u.is_active = true
  AND u.role IN (
    'diretor','gerente','financeiro','manutencao',
    'vendedora','pos_vendas','decoracao','rh'
  )
ON CONFLICT (user_id, unit_id, module, action) DO NOTHING;

-- ------------------------------------------------------------
-- Backfill 2: relatorios.view para diretor ativo (unit_id NULL)
-- super_admin bypass; gerente/financeiro via overrides individuais (não aqui).
-- ------------------------------------------------------------
INSERT INTO public.user_permissions (user_id, unit_id, module, action, granted)
SELECT
  u.id         AS user_id,
  NULL::UUID   AS unit_id,
  'relatorios' AS module,
  'view'       AS action,
  true         AS granted
FROM public.users u
WHERE u.is_active = true
  AND u.role = 'diretor'
ON CONFLICT (user_id, unit_id, module, action) DO NOTHING;

-- ------------------------------------------------------------
-- Pós-condição: 0 gaps
--   dashboard.view para os 8 cargos; relatorios.view para diretor
-- ------------------------------------------------------------
DO $$
DECLARE
  v_dash_after INT;
  v_rel_after  INT;
  v_gap_dash   INT;
  v_gap_rel    INT;
BEGIN
  SELECT COUNT(*) INTO v_dash_after
  FROM public.user_permissions WHERE module = 'dashboard' AND action = 'view';
  SELECT COUNT(*) INTO v_rel_after
  FROM public.user_permissions WHERE module = 'relatorios' AND action = 'view';

  SELECT COUNT(*) INTO v_gap_dash
  FROM public.users u
  WHERE u.is_active = true
    AND u.role IN (
      'diretor','gerente','financeiro','manutencao',
      'vendedora','pos_vendas','decoracao','rh'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = u.id
        AND up.module = 'dashboard'
        AND up.action = 'view'
        AND up.granted = true
    );

  SELECT COUNT(*) INTO v_gap_rel
  FROM public.users u
  WHERE u.is_active = true
    AND u.role = 'diretor'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = u.id
        AND up.module = 'relatorios'
        AND up.action = 'view'
        AND up.granted = true
    );

  RAISE NOTICE 'user_permissions dashboard.view após: % | relatorios.view após: %', v_dash_after, v_rel_after;
  RAISE NOTICE 'gaps dashboard.view (8 cargos): % | gaps relatorios.view (diretor): %', v_gap_dash, v_gap_rel;

  IF v_gap_dash > 0 THEN
    RAISE EXCEPTION 'Cobertura incompleta: % usuários (8 cargos) sem dashboard.view. Investigar antes da Parte 2.', v_gap_dash;
  END IF;
  IF v_gap_rel > 0 THEN
    RAISE EXCEPTION 'Cobertura incompleta: % diretores sem relatorios.view. Investigar antes da Parte 2.', v_gap_rel;
  END IF;

  RAISE NOTICE 'OK: backfill completo — 0 gaps em dashboard.view (8 cargos) e relatorios.view (diretor).';
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
