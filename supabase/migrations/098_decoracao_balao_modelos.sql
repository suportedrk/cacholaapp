-- ============================================================
-- Migration 098 — Módulo Decoração: Balões — modelos e preços
-- Objetivo: tabela global de modelos de balão com custo e
-- valor de venda; seed com 31 modelos; RLS idêntica às
-- demais tabelas decoracao_*.
-- ============================================================

BEGIN;

-- ── 1. Tabela ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.decoracao_balao_modelos (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         TEXT          NOT NULL,
  categoria    TEXT          NULL,
  custo        NUMERIC(12,2) NULL,
  valor_venda  NUMERIC(12,2) NULL,
  ativo        BOOLEAN       NOT NULL DEFAULT true,
  observacoes  TEXT          NULL,
  foto_url     TEXT          NULL,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ── 1b. GRANTS de tabela (papel authenticated do PostgREST) ──
-- Obrigatório: sem GRANT explícito, o PostgREST retorna
-- "permission denied for table" ANTES de avaliar a RLS.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decoracao_balao_modelos TO authenticated;

-- ── 2. Trigger updated_at ─────────────────────────────────────

CREATE OR REPLACE TRIGGER trg_decoracao_balao_modelos_updated_at
  BEFORE UPDATE ON public.decoracao_balao_modelos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 3. RLS ───────────────────────────────────────────────────
-- Módulo global (sem unit_id). check_permission() — 3 args.
-- view  → DECORACAO_MANAGE_ROLES (via check_permission) + global viewers
-- create/edit → DECORACAO_MANAGE_ROLES
-- delete → DECORACAO_DELETE_ROLES (super_admin, diretor)

ALTER TABLE public.decoracao_balao_modelos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "decoracao_balao_modelos: view"   ON public.decoracao_balao_modelos;
DROP POLICY IF EXISTS "decoracao_balao_modelos: create" ON public.decoracao_balao_modelos;
DROP POLICY IF EXISTS "decoracao_balao_modelos: edit"   ON public.decoracao_balao_modelos;
DROP POLICY IF EXISTS "decoracao_balao_modelos: delete" ON public.decoracao_balao_modelos;

CREATE POLICY "decoracao_balao_modelos: view"
  ON public.decoracao_balao_modelos FOR SELECT TO authenticated
  USING (is_global_viewer() OR check_permission(auth.uid(), 'decoracao', 'view'));

CREATE POLICY "decoracao_balao_modelos: create"
  ON public.decoracao_balao_modelos FOR INSERT TO authenticated
  WITH CHECK (check_permission(auth.uid(), 'decoracao', 'create'));

CREATE POLICY "decoracao_balao_modelos: edit"
  ON public.decoracao_balao_modelos FOR UPDATE TO authenticated
  USING  (check_permission(auth.uid(), 'decoracao', 'edit'))
  WITH CHECK (check_permission(auth.uid(), 'decoracao', 'edit'));

CREATE POLICY "decoracao_balao_modelos: delete"
  ON public.decoracao_balao_modelos FOR DELETE TO authenticated
  USING (check_permission(auth.uid(), 'decoracao', 'delete'));

-- ── 4. Seed — 31 modelos ─────────────────────────────────────
-- Nomes preservados exatamente como fornecidos.
-- NULL = sem valor informado.
-- "Arco completo ANTIGO" entra com ativo=false.

INSERT INTO public.decoracao_balao_modelos
  (nome, categoria, custo, valor_venda, ativo)
VALUES
  ('Meio arco + complemento',                       NULL, 800.00,  1300.00, true),
  ('Meio arco + pendurados',                        NULL, 900.00,  1800.00, true),
  ('Arco completo ANTIGO',                          NULL, 1600.00, 1700.00, false),
  ('Dois meio arcos',                               NULL, 1400.00, 1900.00, true),
  ('Arranjo pendurado com 10 balões',               NULL, 500.00,  1000.00, true),
  ('Meio arco com planetas pintados',               NULL, 1100.00, 1500.00, true),
  ('Só pendurados sobre a mesa',                    NULL, 800.00,  1800.00, true),
  ('Centro de mesa 3 balões',                       NULL, 56.00,   80.00,   true),
  ('Centro de mesa 1 balão big',                    NULL, 200.00,  250.00,  true),
  ('Centro de mesa 1 balão 16"',                    NULL, 80.00,   150.00,  true),
  ('Balões embaixo da árvore (só frente)',          NULL, 650.00,  1300.00, true),
  ('Balões embaixo da árvore (volta toda)',         NULL, 1200.00, 3000.00, true),
  ('Balões na entrada principal',                   NULL, 1600.00, 2000.00, true),
  ('Balões na entrada infantil',                    NULL, 500.00,  800.00,  true),
  ('Balões no fusca',                               NULL, 3200.00, 4200.00, true),
  ('Balões Especial Transformers',                  NULL, 1000.00, 1500.00, true),
  ('Especial',                                      NULL, NULL,    NULL,    true),
  ('Guirlanda sobre a mesa',                        NULL, 800.00,  1300.00, true),
  ('5 Correntes de bolinhas',                       NULL, 800.00,  1300.00, true),
  ('30 balões pendurados na árvore',                NULL, 700.00,  1500.00, true),
  ('Balões pendurados em qtd para mesa de 8m',      NULL, 1000.00, 1500.00, true),
  ('Fachada de balões com desconto',                NULL, 1500.00, NULL,    true),
  ('Balao big gás Helio',                           NULL, 200.00,  NULL,    true),
  ('Balão da mesa do artista',                      NULL, NULL,    1500.00, true),
  ('Arco completo ATUAL',                           NULL, 1400.00, 1700.00, true),
  ('Balões pendurados com franjas',                 NULL, 1000.00, 1500.00, true),
  ('Polvo gigante (escultura)',                     NULL, 3200.00, 4000.00, true),
  ('Polvo grande (escultura)',                      NULL, 2800.00, 3500.00, true),
  ('Polvo médio (escultura)',                       NULL, 1300.00, 1700.00, true),
  ('15 balões 16" com gás hélio',                   NULL, 1000.00, 1500.00, true),
  ('BALÃO NÚMERO GÁS HÉLIO',                        NULL, NULL,    NULL,    true)
ON CONFLICT DO NOTHING;

-- ── 5. Reload schema PostgREST ────────────────────────────────
NOTIFY pgrst, 'reload schema';

COMMIT;
