-- ============================================================
-- Migration 116 — Checklist Comercial: template + backfill (Fase 2)
-- Criado em: 2026-05-26
-- Referência: docs/rbac/proposta-arquitetura-alvo.md
--             + Aprendizado 1 (backfill aditivo antes de RLS)
--             + Aprendizado 2 (portar só ações em uso)
--             + Aprendizado 5 (semânticas distintas de view por tabela)
--
-- Primeira de DUAS migrations para checklist_comercial. Combina dois
-- efeitos não-destrutivos em uma só transação:
--
--   1. Alinhamento do template: conceder pos_vendas create/edit/delete
--      = true em role_permissions. Hoje o template só dá view, mas o
--      acesso real é amplo (pos_vendas é is_global_viewer → escreve
--      em tudo via RLS). Aprovado preservar (Q2).
--
--   2. Backfill aditivo em user_permissions:
--      - diretor:    view, create, edit, delete
--      - pos_vendas: view, create, edit, delete (preserva escrita ampla)
--      - vendedora:  view
--      - super_admin: NÃO precisa (bypass em check_permission)
--      - gerente + 6 cargos sem tela (decoracao, manutencao, financeiro,
--        rh, freelancer, entregador): NADA — duas reduções aprovadas
--        (gerente sai do acesso amplo; 6 cargos perdem leitura de
--        templates globais).
--
-- Idempotente. Não-destrutivo.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Pré-condição: catálogo permission_controls tem as ações
-- ------------------------------------------------------------
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.permission_controls
  WHERE module_code = 'checklist_comercial'
    AND code IN ('view','create','edit','delete')
    AND kind = 'action';

  IF v_count <> 4 THEN
    RAISE EXCEPTION
      'Abortando: esperava 4 ações (view/create/edit/delete) em permission_controls para checklist_comercial, encontrei %. Migration 107 precisa estar aplicada.',
      v_count;
  END IF;
END
$$;

-- ------------------------------------------------------------
-- PASSO 1 — Alinhar template: pos_vendas ganha create/edit/delete
-- ------------------------------------------------------------
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('pos_vendas', 'checklist_comercial', 'create', true),
  ('pos_vendas', 'checklist_comercial', 'edit',   true),
  ('pos_vendas', 'checklist_comercial', 'delete', true)
ON CONFLICT (role_code, module_code, action) DO UPDATE
  SET granted    = EXCLUDED.granted,
      updated_at = now();

-- Validação: linhas existem e estão true
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.role_permissions
  WHERE role_code   = 'pos_vendas'
    AND module_code = 'checklist_comercial'
    AND action IN ('create','edit','delete')
    AND granted = true;

  IF v_count <> 3 THEN
    RAISE EXCEPTION
      'Falha ao alinhar template: esperava 3 linhas pos_vendas×checklist_comercial×(create/edit/delete) granted=true, encontrei %.',
      v_count;
  END IF;

  RAISE NOTICE 'OK: template alinhado — pos_vendas.checklist_comercial.create/edit/delete = true.';
END
$$;

-- ------------------------------------------------------------
-- PASSO 2 — Backfill aditivo de user_permissions
-- ------------------------------------------------------------
DO $$
DECLARE
  v_before INT;
BEGIN
  SELECT COUNT(*) INTO v_before
  FROM public.user_permissions WHERE module = 'checklist_comercial';
  RAISE NOTICE 'user_permissions em checklist_comercial antes do backfill: %', v_before;
END
$$;

-- diretor: view/create/edit/delete
INSERT INTO public.user_permissions (user_id, unit_id, module, action, granted)
SELECT
  u.id              AS user_id,
  NULL::UUID        AS unit_id,
  'checklist_comercial' AS module,
  a                 AS action,
  true              AS granted
FROM public.users u
CROSS JOIN (VALUES ('view'), ('create'), ('edit'), ('delete')) AS actions(a)
WHERE u.role = 'diretor'
  AND u.is_active = true
ON CONFLICT (user_id, unit_id, module, action) DO NOTHING;

-- pos_vendas: view/create/edit/delete (preserva acesso amplo — Q2)
INSERT INTO public.user_permissions (user_id, unit_id, module, action, granted)
SELECT
  u.id              AS user_id,
  NULL::UUID        AS unit_id,
  'checklist_comercial' AS module,
  a                 AS action,
  true              AS granted
FROM public.users u
CROSS JOIN (VALUES ('view'), ('create'), ('edit'), ('delete')) AS actions(a)
WHERE u.role = 'pos_vendas'
  AND u.is_active = true
ON CONFLICT (user_id, unit_id, module, action) DO NOTHING;

-- vendedora: view
INSERT INTO public.user_permissions (user_id, unit_id, module, action, granted)
SELECT
  u.id              AS user_id,
  NULL::UUID        AS unit_id,
  'checklist_comercial' AS module,
  'view'            AS action,
  true              AS granted
FROM public.users u
WHERE u.role = 'vendedora'
  AND u.is_active = true
ON CONFLICT (user_id, unit_id, module, action) DO NOTHING;

-- ------------------------------------------------------------
-- Pós-condição: cobertura completa
-- ------------------------------------------------------------
DO $$
DECLARE
  v_after        INT;
  v_diretor_gap  INT;
  v_posvendas_gap INT;
  v_vendedora_gap INT;
BEGIN
  SELECT COUNT(*) INTO v_after
  FROM public.user_permissions WHERE module = 'checklist_comercial';

  -- Diretor: cada ativo deve ter 4 ações
  SELECT COUNT(*) INTO v_diretor_gap
  FROM public.users u
  WHERE u.role = 'diretor' AND u.is_active = true
    AND (
      SELECT COUNT(*) FROM public.user_permissions up
      WHERE up.user_id = u.id
        AND up.module = 'checklist_comercial'
        AND up.action IN ('view','create','edit','delete')
        AND up.granted = true
    ) <> 4;

  -- Pos_vendas: cada ativo deve ter 4 ações
  SELECT COUNT(*) INTO v_posvendas_gap
  FROM public.users u
  WHERE u.role = 'pos_vendas' AND u.is_active = true
    AND (
      SELECT COUNT(*) FROM public.user_permissions up
      WHERE up.user_id = u.id
        AND up.module = 'checklist_comercial'
        AND up.action IN ('view','create','edit','delete')
        AND up.granted = true
    ) <> 4;

  -- Vendedora: cada ativa deve ter view
  SELECT COUNT(*) INTO v_vendedora_gap
  FROM public.users u
  WHERE u.role = 'vendedora' AND u.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = u.id
        AND up.module = 'checklist_comercial'
        AND up.action = 'view'
        AND up.granted = true
    );

  RAISE NOTICE 'user_permissions em checklist_comercial após backfill: %', v_after;
  RAISE NOTICE 'diretores ativos sem cobertura completa (4 ações): %', v_diretor_gap;
  RAISE NOTICE 'pos_vendas ativos sem cobertura completa (4 ações): %', v_posvendas_gap;
  RAISE NOTICE 'vendedoras ativas sem view: %', v_vendedora_gap;

  IF v_diretor_gap > 0 OR v_posvendas_gap > 0 OR v_vendedora_gap > 0 THEN
    RAISE WARNING
      'Cobertura incompleta após backfill — investigar antes da migration 117.';
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
