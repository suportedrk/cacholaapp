-- ============================================================
-- Migration 115 — Unidades: alinhamento de template (Fase 2)
-- Criado em: 2026-05-26
-- Referência: docs/rbac/proposta-arquitetura-alvo.md
--             + Aprendizado 4 (operações estruturais de infra)
--
-- Unidades é uma tabela ESTRUTURAL: criar/editar/deletar unidades
-- afeta toda a hierarquia do sistema e só ocorre via service_role
-- (POST /api/admin/units → createAdminClient). A RLS atual —
-- `units: super_admin manage` — bloqueia qualquer JWT que não
-- seja super_admin, inclusive diretor.
--
-- O template em role_permissions tinha diretor.unidades.create/
-- edit/delete = true — mentindo sobre o acesso real.
-- Esta migration SOMENTE corrige esse drift declarativo.
--
--   NENHUMA MUDANÇA DE RLS.
--   NENHUMA MUDANÇA DE POLÍTICA.
--   APENAS 3 UPDATEs em role_permissions.
--
-- Resultado esperado: comportamento de runtime IDÊNTICO antes e
-- depois. Apenas o template fica honesto.
--
-- Pré-condições:
--   - migration 071 aplicada (role_permissions catalog)
--   - migration 107 aplicada (permission_controls catalog)
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Pré-validação: as 3 linhas existem e estão como true
-- ------------------------------------------------------------
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.role_permissions
  WHERE role_code = 'diretor'
    AND module_code = 'unidades'
    AND action IN ('create', 'edit', 'delete')
    AND granted = true;

  IF v_count <> 3 THEN
    RAISE NOTICE
      'Aviso: esperava 3 linhas diretor×unidades×(create/edit/delete) com granted=true, encontrei %. A migration pode ter sido aplicada antes ou o seed está diferente.',
      v_count;
  END IF;
END
$$;

-- ------------------------------------------------------------
-- Corrigir template: diretor.unidades.create/edit/delete = false
-- ------------------------------------------------------------
-- O template mentia: indicava que diretor pode criar/editar/deletar
-- unidades, mas a RLS (units: super_admin manage) só permite
-- super_admin via JWT. Toda escrita válida ocorre via service_role.
UPDATE public.role_permissions
SET granted     = false,
    updated_at  = now()
WHERE role_code  = 'diretor'
  AND module_code = 'unidades'
  AND action IN ('create', 'edit', 'delete');

-- ------------------------------------------------------------
-- Pós-validação
-- ------------------------------------------------------------
DO $$
DECLARE
  v_wrong INT;
BEGIN
  SELECT COUNT(*) INTO v_wrong
  FROM public.role_permissions
  WHERE role_code   = 'diretor'
    AND module_code = 'unidades'
    AND action IN ('create', 'edit', 'delete')
    AND granted = true;

  IF v_wrong > 0 THEN
    RAISE EXCEPTION
      'Pós-condição falhou: % linha(s) diretor×unidades×(create/edit/delete) ainda com granted=true.',
      v_wrong;
  END IF;

  RAISE NOTICE 'OK: diretor.unidades.create/edit/delete = false (alinhado à RLS atual).';
  RAISE NOTICE 'NOTA: diretor.unidades.view permanece true (catálogo global).';
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
