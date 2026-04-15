-- ============================================================
-- Migration 045 — Pré-reservas Diretoria
-- Pré-reservas de data criadas pela diretoria/admin, visíveis
-- no calendário do Dashboard para todos os usuários autenticados.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- TABELA
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pre_reservas_diretoria (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         UUID        NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  date            DATE        NOT NULL,
  time            TIME,
  client_name     TEXT        NOT NULL,
  client_contact  TEXT,
  description     TEXT,
  created_by      UUID        NOT NULL REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_pre_reservas_unit_date ON public.pre_reservas_diretoria(unit_id, date);
CREATE INDEX IF NOT EXISTS idx_pre_reservas_date      ON public.pre_reservas_diretoria(date);

-- Trigger updated_at (função já existe em 001_initial_schema.sql — não recriar)
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.pre_reservas_diretoria
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE public.pre_reservas_diretoria IS
  'Pré-reservas criadas pela diretoria, visíveis no calendário para todos';

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.pre_reservas_diretoria ENABLE ROW LEVEL SECURITY;

-- SELECT: todos os usuários autenticados (todas as unidades)
CREATE POLICY "pre_reservas_select_all"
  ON public.pre_reservas_diretoria FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: somente super_admin e diretor
CREATE POLICY "pre_reservas_insert_admin_diretor"
  ON public.pre_reservas_diretoria FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('super_admin', 'diretor')
    )
  );

-- UPDATE: somente super_admin e diretor
CREATE POLICY "pre_reservas_update_admin_diretor"
  ON public.pre_reservas_diretoria FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('super_admin', 'diretor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('super_admin', 'diretor')
    )
  );

-- DELETE: somente super_admin e diretor
CREATE POLICY "pre_reservas_delete_admin_diretor"
  ON public.pre_reservas_diretoria FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('super_admin', 'diretor')
    )
  );
