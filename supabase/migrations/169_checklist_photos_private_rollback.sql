-- ============================================================
-- ROLLBACK da Migration 169 — volta checklist-photos a público
-- ============================================================
-- ⚠️ Reverter REABRE a exposição: as fotos voltam a ser legíveis por URL pública
-- sem autenticação. Só use se a UI quebrar e for preciso destravar rápido.
-- Nota: após o backfill, photo_url guarda PATH; com o bucket público de novo, a
-- exibição via signed URL continua funcionando (signed URL vale em bucket
-- público também), então o rollback do bucket NÃO exige reverter o app.
-- Idempotente.
-- ============================================================

UPDATE storage.buckets
SET public = TRUE
WHERE id = 'checklist-photos';
