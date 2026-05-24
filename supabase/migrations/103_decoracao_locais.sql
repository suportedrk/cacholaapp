-- ============================================================
-- Migration 103 — Módulo Decoração: Locais de Guarda
-- Objetivo: tabela global de locais de guarda do estoque;
-- RLS idêntica às demais tabelas decoracao_* (102).
-- Ação de remoção = desativar (ativo=false); delete permanente
-- restrito a DECORACAO_DELETE_ROLES via RLS.
-- Seed inicial: Pinheiros e Moema.
-- ============================================================

BEGIN;

-- ── 1. Tabela ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.decoracao_locais (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         TEXT        NOT NULL,
  observacoes  TEXT        NULL,
  ativo        BOOLEAN     NOT NULL DEFAULT true,
  created_by   UUID        NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_decoracao_locais_nome UNIQUE (nome)
);

-- ── 1b. Índices ───────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_decoracao_locais_ativo
  ON public.decoracao_locais (ativo);

CREATE INDEX IF NOT EXISTS idx_decoracao_locais_nome
  ON public.decoracao_locais (nome);

-- ── 1c. GRANTS (papel authenticated do PostgREST) ─────────────
-- Obrigatório: sem GRANT explícito o PostgREST retorna
-- "permission denied" ANTES de avaliar a RLS.

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.decoracao_locais TO authenticated;

-- ── 2. Trigger updated_at ─────────────────────────────────────

CREATE OR REPLACE TRIGGER trg_decoracao_locais_updated_at
  BEFORE UPDATE ON public.decoracao_locais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 3. RLS ───────────────────────────────────────────────────
-- Tabela global (sem unit_id). check_permission() — 3 args.
-- view  → DECORACAO_MANAGE_ROLES + global viewers
-- create/edit → DECORACAO_MANAGE_ROLES
-- delete → DECORACAO_DELETE_ROLES (super_admin, diretor)

ALTER TABLE public.decoracao_locais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "decoracao_locais: view"   ON public.decoracao_locais;
DROP POLICY IF EXISTS "decoracao_locais: create" ON public.decoracao_locais;
DROP POLICY IF EXISTS "decoracao_locais: edit"   ON public.decoracao_locais;
DROP POLICY IF EXISTS "decoracao_locais: delete" ON public.decoracao_locais;

CREATE POLICY "decoracao_locais: view"
  ON public.decoracao_locais FOR SELECT TO authenticated
  USING (is_global_viewer() OR check_permission(auth.uid(), 'decoracao', 'view'));

CREATE POLICY "decoracao_locais: create"
  ON public.decoracao_locais FOR INSERT TO authenticated
  WITH CHECK (check_permission(auth.uid(), 'decoracao', 'create'));

CREATE POLICY "decoracao_locais: edit"
  ON public.decoracao_locais FOR UPDATE TO authenticated
  USING  (check_permission(auth.uid(), 'decoracao', 'edit'))
  WITH CHECK (check_permission(auth.uid(), 'decoracao', 'edit'));

CREATE POLICY "decoracao_locais: delete"
  ON public.decoracao_locais FOR DELETE TO authenticated
  USING (check_permission(auth.uid(), 'decoracao', 'delete'));

-- ── 4. Seed inicial ───────────────────────────────────────────

INSERT INTO public.decoracao_locais (nome, ativo)
VALUES
  ('Pinheiros', true),
  ('Moema',     true)
ON CONFLICT (nome) DO NOTHING;

-- ── 5. Reload schema PostgREST ────────────────────────────────

NOTIFY pgrst, 'reload schema';

COMMIT;
