-- ============================================================
-- ROLLBACK da Migration 172 — volta SELECT/INSERT de checklist-photos a auth-only
-- ============================================================
-- Restaura as policies da mig 007 (so exigem auth.uid() IS NOT NULL). ⚠️ Reverter
-- reabre o residual: qualquer autenticado mintaria signed URL / subiria foto se
-- souber o path. Use só se o role-gate quebrar visualizador/uploader legitimo.
-- Idempotente. (DELETE owner-based nao foi tocada pela 172, entao nao consta aqui.)
-- ============================================================

DROP POLICY IF EXISTS "checklist_photos: authenticated read" ON storage.objects;
CREATE POLICY "checklist_photos: authenticated read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'checklist-photos'
    AND auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "checklist_photos: authenticated insert" ON storage.objects;
CREATE POLICY "checklist_photos: authenticated insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'checklist-photos'
    AND auth.uid() IS NOT NULL
  );
