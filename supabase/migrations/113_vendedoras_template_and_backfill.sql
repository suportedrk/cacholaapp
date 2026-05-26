-- ============================================================
-- Migration 113 — Vendedoras: template fix + backfill aditivo (Fase 2)
-- Criado em: 2026-05-26
-- Referência: docs/rbac/proposta-arquitetura-alvo.md
--             + Opção A do dono (2026-05-26) — preservar SELECT aberto,
--               travar só escrita; corrigir template do diretor.
--
-- Primeira de DUAS migrations para vendedoras. Combina dois efeitos
-- não-destrutivos em uma só transação:
--
--   1. Correção declarativa do template: diretor.vendedoras.delete
--      é setado para false. Hoje o template diz true, mas a RLS
--      atual (053) só permite super_admin deletar — ou seja, o
--      template está mentindo. Esse fix ALINHA o template à
--      realidade. Não muda comportamento de runtime (RLS é a
--      fonte de verdade hoje).
--
--   2. Backfill aditivo em user_permissions: para cada diretor
--      ativo, garante linhas (vendedoras, create) e (vendedoras, edit)
--      com granted=true e unit_id=NULL. ON CONFLICT DO NOTHING
--      preserva customizações pré-existentes. super_admin é
--      EXCLUÍDO de propósito (bypass em check_permission).
--      Sem 'view': SELECT em sellers continua governado pela policy
--      original (auth.uid() IS NOT NULL) — não é trocada na 114.
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
  WHERE module_code = 'vendedoras'
    AND code IN ('create','edit','delete')
    AND kind = 'action';

  IF v_count <> 3 THEN
    RAISE EXCEPTION
      'Abortando: esperava 3 ações (create/edit/delete) em permission_controls para vendedoras, encontrei %. Migration 107 precisa estar aplicada.',
      v_count;
  END IF;
END
$$;

-- ------------------------------------------------------------
-- PASSO 1 — Corrigir template: diretor.vendedoras.delete = false
-- ------------------------------------------------------------
-- O template está dessincronizado da realidade: marca delete=true
-- para diretor, mas a RLS sempre bloqueou. Setamos false para
-- refletir o acesso real e evitar surpresa após a 114 (que troca
-- delete para check_permission).
UPDATE public.role_permissions
SET granted = false,
    updated_at = now()
WHERE role_code = 'diretor'
  AND module_code = 'vendedoras'
  AND action = 'delete';

-- Validação: linha existe e ficou false
DO $$
DECLARE
  v_granted BOOLEAN;
BEGIN
  SELECT granted INTO v_granted
  FROM public.role_permissions
  WHERE role_code = 'diretor'
    AND module_code = 'vendedoras'
    AND action = 'delete';

  IF v_granted IS NULL THEN
    RAISE EXCEPTION 'Linha role_permissions(diretor, vendedoras, delete) não encontrada — esperava existir do seed 071.';
  END IF;

  IF v_granted = true THEN
    RAISE EXCEPTION 'Falha ao atualizar: diretor.vendedoras.delete ainda é true.';
  END IF;

  RAISE NOTICE 'OK: diretor.vendedoras.delete = false no template (alinhado à RLS atual).';
END
$$;

-- ------------------------------------------------------------
-- PASSO 2 — Backfill aditivo de user_permissions para diretores
-- ------------------------------------------------------------
DO $$
DECLARE
  v_before INT;
BEGIN
  SELECT COUNT(*) INTO v_before
  FROM public.user_permissions WHERE module = 'vendedoras';
  RAISE NOTICE 'user_permissions em vendedoras antes do backfill: %', v_before;
END
$$;

INSERT INTO public.user_permissions (user_id, unit_id, module, action, granted)
SELECT
  u.id              AS user_id,
  NULL::UUID        AS unit_id,
  'vendedoras'      AS module,
  a                 AS action,
  true              AS granted
FROM public.users u
CROSS JOIN (VALUES ('create'), ('edit')) AS actions(a)
WHERE u.role = 'diretor'
  AND u.is_active = true
ON CONFLICT (user_id, unit_id, module, action) DO NOTHING;

-- ------------------------------------------------------------
-- Pós-condição: cada diretor ativo tem create+edit granted=true
-- ------------------------------------------------------------
DO $$
DECLARE
  v_after INT;
  v_short INT;
BEGIN
  SELECT COUNT(*) INTO v_after
  FROM public.user_permissions WHERE module = 'vendedoras';

  SELECT COUNT(*) INTO v_short
  FROM public.users u
  WHERE u.role = 'diretor' AND u.is_active = true
    AND (
      SELECT COUNT(*) FROM public.user_permissions up
      WHERE up.user_id = u.id
        AND up.module = 'vendedoras'
        AND up.action IN ('create','edit')
        AND up.granted = true
    ) <> 2;

  RAISE NOTICE 'user_permissions em vendedoras após backfill: %', v_after;
  RAISE NOTICE 'diretores ativos SEM cobertura completa (create+edit granted=true): %', v_short;

  IF v_short > 0 THEN
    RAISE WARNING
      '% diretor(es) ativo(s) ficaram sem cobertura completa em vendedoras. Investigar antes da migration 114.',
      v_short;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
