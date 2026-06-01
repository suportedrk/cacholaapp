-- ============================================================
-- Migration 133 — Decoração Bloco E: Fotos da Montagem
-- Galeria de fotos da decoração montada na festa. Registro das
-- montagens (várias fotos por festa), distinto da foto override
-- da festa (representativa única do Bloco C).
--
-- Storage: bucket decoracao-festa (privado, já existe).
-- Pasta por festa: {festa_decoracao_id}/fotos/{timestamp-random}.jpg
--
-- RLS (padrão global decoracao; lição da tabela-filha do Bloco B):
--   SELECT = 'view'  (quem vê a decoração vê as fotos)
--   INSERT/UPDATE/DELETE = 'edit' (subir/editar/remover = editar a
--     decoração; não exige 'delete' separado — alinhado com Bloco D
--     quarentena e com a decisão de negócio)
--
-- RBAC nascendo dourado: APIs via requirePermission('decoracao', action).
--
-- Rollback: 133_decoracao_festa_fotos_rollback.sql
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.decoracao_festa_fotos (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  festa_decoracao_id  uuid        NOT NULL
                                    REFERENCES public.decoracao_festa(id)
                                    ON DELETE CASCADE,
  foto_path           text        NOT NULL,
  legenda             text,
  ordem               int         NOT NULL DEFAULT 0,
  created_by          uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decoracao_festa_fotos_festa
  ON public.decoracao_festa_fotos (festa_decoracao_id);

-- Trigger updated_at (reutiliza a função global do projeto)
CREATE OR REPLACE TRIGGER trg_decoracao_festa_fotos_updated_at
  BEFORE UPDATE ON public.decoracao_festa_fotos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- GRANT (papel authenticated do PostgREST)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decoracao_festa_fotos TO authenticated;

-- ── RLS ───────────────────────────────────────────────────────

ALTER TABLE public.decoracao_festa_fotos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "decoracao_festa_fotos: view"   ON public.decoracao_festa_fotos;
DROP POLICY IF EXISTS "decoracao_festa_fotos: insert" ON public.decoracao_festa_fotos;
DROP POLICY IF EXISTS "decoracao_festa_fotos: update" ON public.decoracao_festa_fotos;
DROP POLICY IF EXISTS "decoracao_festa_fotos: delete" ON public.decoracao_festa_fotos;

CREATE POLICY "decoracao_festa_fotos: view"
  ON public.decoracao_festa_fotos FOR SELECT TO authenticated
  USING (is_global_viewer() OR check_permission(auth.uid(), 'decoracao', 'view'));

CREATE POLICY "decoracao_festa_fotos: insert"
  ON public.decoracao_festa_fotos FOR INSERT TO authenticated
  WITH CHECK (check_permission(auth.uid(), 'decoracao', 'edit'));

CREATE POLICY "decoracao_festa_fotos: update"
  ON public.decoracao_festa_fotos FOR UPDATE TO authenticated
  USING      (check_permission(auth.uid(), 'decoracao', 'edit'))
  WITH CHECK (check_permission(auth.uid(), 'decoracao', 'edit'));

-- Remover foto da galeria = editar a decoração (não exige 'delete')
CREATE POLICY "decoracao_festa_fotos: delete"
  ON public.decoracao_festa_fotos FOR DELETE TO authenticated
  USING (check_permission(auth.uid(), 'decoracao', 'edit'));

-- ── Reload schema PostgREST ───────────────────────────────────

NOTIFY pgrst, 'reload schema';

COMMIT;
