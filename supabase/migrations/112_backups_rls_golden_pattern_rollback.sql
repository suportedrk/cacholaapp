-- ============================================================
-- Rollback da Migration 112 — Backups RLS golden pattern
--
-- Restaura a policy "backup_log_select" original (role IN inline)
-- da migration 067.
--
-- Idempotente.
-- ============================================================

BEGIN;

-- DROP a policy nova
DROP POLICY IF EXISTS "backups: view" ON public.backup_log;

-- RESTORE a policy original da 067 (idempotente)
DROP POLICY IF EXISTS "backup_log_select" ON public.backup_log;

CREATE POLICY "backup_log_select" ON public.backup_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'diretor')
    )
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
