-- ============================================================
-- Migration 067 — backup_log
-- Registra execuções dos scripts de backup (local + R2 upload).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.backup_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          text        NOT NULL CHECK (kind IN ('daily', 'weekly', 'monthly')),
  source        text        NOT NULL CHECK (source IN ('local', 'r2_upload')),
  filename      text        NOT NULL,
  r2_key        text,
  size_bytes    bigint,
  checksum      text,
  status        text        NOT NULL CHECK (status IN ('in_progress', 'success', 'failed')),
  error_message text,
  started_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Garante idempotência nos INSERTs dos scripts (ON CONFLICT DO NOTHING)
CREATE UNIQUE INDEX IF NOT EXISTS idx_backup_log_uniq
  ON public.backup_log (kind, source, filename);

CREATE INDEX IF NOT EXISTS idx_backup_log_kind_started
  ON public.backup_log (kind, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_backup_log_source_status
  ON public.backup_log (source, status);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.backup_log ENABLE ROW LEVEL SECURITY;

-- Somente super_admin e diretor podem ler
CREATE POLICY "backup_log_select" ON public.backup_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'diretor')
    )
  );

-- Scripts de backup usam service_role key — não precisam de policy INSERT/UPDATE
-- (service_role bypassa RLS por padrão)
