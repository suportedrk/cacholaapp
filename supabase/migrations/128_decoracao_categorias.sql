-- ============================================================
-- Migration 128 — Módulo Decoração: Categorias de item
-- Objetivo: tabela global de categorias de itens do estoque;
-- RLS idêntica às demais tabelas decoracao_* (103).
-- Ação de remoção = desativar (ativo=false); delete permanente
-- restrito a DECORACAO_DELETE_ROLES via RLS.
-- Seed inicial: 10 categorias na ordem pedida (ordem 0–9).
-- ============================================================

BEGIN;

-- ── 1. Tabela ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.decoracao_categorias (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT        NOT NULL,
  ordem      INT         NOT NULL DEFAULT 0,
  ativo      BOOLEAN     NOT NULL DEFAULT true,
  created_by UUID        NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_decoracao_categorias_nome UNIQUE (nome)
);

-- ── 1b. Índices ───────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_decoracao_categorias_ativo
  ON public.decoracao_categorias (ativo);

CREATE INDEX IF NOT EXISTS idx_decoracao_categorias_nome
  ON public.decoracao_categorias (nome);

-- ── 1c. GRANTS (papel authenticated do PostgREST) ─────────────
-- Obrigatório: sem GRANT explícito o PostgREST retorna
-- "permission denied" ANTES de avaliar a RLS.

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.decoracao_categorias TO authenticated;

-- ── 2. Trigger updated_at ─────────────────────────────────────

CREATE OR REPLACE TRIGGER trg_decoracao_categorias_updated_at
  BEFORE UPDATE ON public.decoracao_categorias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 3. RLS ───────────────────────────────────────────────────
-- Tabela global (sem unit_id). check_permission() — 3 args.
-- view  → DECORACAO_MANAGE_ROLES + global viewers
-- create/edit → DECORACAO_MANAGE_ROLES
-- delete → DECORACAO_DELETE_ROLES (super_admin, diretor)

ALTER TABLE public.decoracao_categorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "decoracao_categorias: view"   ON public.decoracao_categorias;
DROP POLICY IF EXISTS "decoracao_categorias: create" ON public.decoracao_categorias;
DROP POLICY IF EXISTS "decoracao_categorias: edit"   ON public.decoracao_categorias;
DROP POLICY IF EXISTS "decoracao_categorias: delete" ON public.decoracao_categorias;

CREATE POLICY "decoracao_categorias: view"
  ON public.decoracao_categorias FOR SELECT TO authenticated
  USING (is_global_viewer() OR check_permission(auth.uid(), 'decoracao', 'view'));

CREATE POLICY "decoracao_categorias: create"
  ON public.decoracao_categorias FOR INSERT TO authenticated
  WITH CHECK (check_permission(auth.uid(), 'decoracao', 'create'));

CREATE POLICY "decoracao_categorias: edit"
  ON public.decoracao_categorias FOR UPDATE TO authenticated
  USING  (check_permission(auth.uid(), 'decoracao', 'edit'))
  WITH CHECK (check_permission(auth.uid(), 'decoracao', 'edit'));

CREATE POLICY "decoracao_categorias: delete"
  ON public.decoracao_categorias FOR DELETE TO authenticated
  USING (check_permission(auth.uid(), 'decoracao', 'delete'));

-- ── 4. Seed inicial ───────────────────────────────────────────

INSERT INTO public.decoracao_categorias (nome, ordem, ativo)
VALUES
  ('Balões',                0, true),
  ('Boleiras',              1, true),
  ('Mobiliário',            2, true),
  ('Displays',              3, true),
  ('Objetos decorativos',   4, true),
  ('Personagens 3D',        5, true),
  ('Bolos falsos',          6, true),
  ('Vasos e cestos',        7, true),
  ('Tecidos',               8, true),
  ('Tapetes',               9, true)
ON CONFLICT (nome) DO NOTHING;

-- ── 5. Reload schema PostgREST ────────────────────────────────

NOTIFY pgrst, 'reload schema';

COMMIT;
