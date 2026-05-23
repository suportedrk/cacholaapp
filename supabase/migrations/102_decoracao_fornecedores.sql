-- ============================================================
-- Migration 102 — Módulo Decoração: Fornecedores
-- Objetivo: tabela global de fornecedores de decoração;
-- RLS idêntica às demais tabelas decoracao_* (098/099/100).
-- Ação de remoção = desativar (ativo=false); delete permanente
-- restrito a DECORACAO_DELETE_ROLES via RLS.
-- ============================================================

BEGIN;

-- ── 1. Tabela ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.decoracao_fornecedores (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         TEXT        NOT NULL,
  telefone     TEXT        NULL,
  email        TEXT        NULL,
  fornece      TEXT        NULL,
  documento    TEXT        NULL,
  observacoes  TEXT        NULL,
  ativo        BOOLEAN     NOT NULL DEFAULT true,
  created_by   UUID        NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 1b. Índices ───────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_decoracao_fornecedores_ativo
  ON public.decoracao_fornecedores (ativo);

CREATE INDEX IF NOT EXISTS idx_decoracao_fornecedores_nome
  ON public.decoracao_fornecedores (nome);

-- ── 1c. GRANTS (papel authenticated do PostgREST) ─────────────
-- Obrigatório: sem GRANT explícito o PostgREST retorna
-- "permission denied" ANTES de avaliar a RLS.

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.decoracao_fornecedores TO authenticated;

-- ── 2. Trigger updated_at ─────────────────────────────────────

CREATE OR REPLACE TRIGGER trg_decoracao_fornecedores_updated_at
  BEFORE UPDATE ON public.decoracao_fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 3. RLS ───────────────────────────────────────────────────
-- Tabela global (sem unit_id). check_permission() — 3 args.
-- view  → DECORACAO_MANAGE_ROLES + global viewers
-- create/edit → DECORACAO_MANAGE_ROLES
-- delete → DECORACAO_DELETE_ROLES (super_admin, diretor)

ALTER TABLE public.decoracao_fornecedores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "decoracao_fornecedores: view"   ON public.decoracao_fornecedores;
DROP POLICY IF EXISTS "decoracao_fornecedores: create" ON public.decoracao_fornecedores;
DROP POLICY IF EXISTS "decoracao_fornecedores: edit"   ON public.decoracao_fornecedores;
DROP POLICY IF EXISTS "decoracao_fornecedores: delete" ON public.decoracao_fornecedores;

CREATE POLICY "decoracao_fornecedores: view"
  ON public.decoracao_fornecedores FOR SELECT TO authenticated
  USING (is_global_viewer() OR check_permission(auth.uid(), 'decoracao', 'view'));

CREATE POLICY "decoracao_fornecedores: create"
  ON public.decoracao_fornecedores FOR INSERT TO authenticated
  WITH CHECK (check_permission(auth.uid(), 'decoracao', 'create'));

CREATE POLICY "decoracao_fornecedores: edit"
  ON public.decoracao_fornecedores FOR UPDATE TO authenticated
  USING  (check_permission(auth.uid(), 'decoracao', 'edit'))
  WITH CHECK (check_permission(auth.uid(), 'decoracao', 'edit'));

CREATE POLICY "decoracao_fornecedores: delete"
  ON public.decoracao_fornecedores FOR DELETE TO authenticated
  USING (check_permission(auth.uid(), 'decoracao', 'delete'));

-- ── 4. Reload schema PostgREST ────────────────────────────────

NOTIFY pgrst, 'reload schema';

COMMIT;
