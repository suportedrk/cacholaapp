-- supabase/migrations/105_decoracao_estoque_saldo.sql
-- Objetivo: Bloco 3 do estoque de decoração — tabela de saldo por variação × local.
-- Uma linha por (variacao_id, local_id); combinação ausente = saldo 0.
-- RLS global (sem unit_id): check_permission no módulo 'decoracao'.

BEGIN;

-- ── Tabela principal ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.decoracao_estoque_saldo (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  variacao_id  UUID         NOT NULL
                              REFERENCES public.decoracao_item_variacoes(id)
                              ON DELETE CASCADE,
  local_id     UUID         NOT NULL
                              REFERENCES public.decoracao_locais(id)
                              ON DELETE RESTRICT,
  quantidade   INTEGER      NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT uq_estoque_variacao_local UNIQUE (variacao_id, local_id)
);

CREATE INDEX IF NOT EXISTS idx_estoque_saldo_variacao
  ON public.decoracao_estoque_saldo (variacao_id);

CREATE INDEX IF NOT EXISTS idx_estoque_saldo_local
  ON public.decoracao_estoque_saldo (local_id);

-- ── Trigger updated_at ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_estoque_saldo_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_estoque_saldo_updated_at ON public.decoracao_estoque_saldo;
CREATE TRIGGER trg_estoque_saldo_updated_at
  BEFORE UPDATE ON public.decoracao_estoque_saldo
  FOR EACH ROW EXECUTE FUNCTION public.trg_estoque_saldo_updated_at();

-- ── GRANT ─────────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.decoracao_estoque_saldo
  TO authenticated;

-- ── RLS — padrão global dos catálogos de decoração ───────────────────────────

ALTER TABLE public.decoracao_estoque_saldo ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas (idempotência)
DROP POLICY IF EXISTS "decoracao_estoque_saldo: view"   ON public.decoracao_estoque_saldo;
DROP POLICY IF EXISTS "decoracao_estoque_saldo: create" ON public.decoracao_estoque_saldo;
DROP POLICY IF EXISTS "decoracao_estoque_saldo: edit"   ON public.decoracao_estoque_saldo;
DROP POLICY IF EXISTS "decoracao_estoque_saldo: delete" ON public.decoracao_estoque_saldo;

CREATE POLICY "decoracao_estoque_saldo: view"
  ON public.decoracao_estoque_saldo
  FOR SELECT
  TO authenticated
  USING (check_permission(auth.uid(), 'decoracao', 'view'));

CREATE POLICY "decoracao_estoque_saldo: create"
  ON public.decoracao_estoque_saldo
  FOR INSERT
  TO authenticated
  WITH CHECK (check_permission(auth.uid(), 'decoracao', 'create'));

CREATE POLICY "decoracao_estoque_saldo: edit"
  ON public.decoracao_estoque_saldo
  FOR UPDATE
  TO authenticated
  USING  (check_permission(auth.uid(), 'decoracao', 'edit'))
  WITH CHECK (check_permission(auth.uid(), 'decoracao', 'edit'));

CREATE POLICY "decoracao_estoque_saldo: delete"
  ON public.decoracao_estoque_saldo
  FOR DELETE
  TO authenticated
  USING (check_permission(auth.uid(), 'decoracao', 'delete'));

-- ── Reload PostgREST ──────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

COMMIT;
