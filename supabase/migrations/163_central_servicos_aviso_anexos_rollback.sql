-- ============================================================
-- Rollback da Migration 163 — Anexos do Mural de Avisos
-- Remove policies de storage, bucket (se vazio), tabela de anexos.
-- ============================================================

DROP POLICY IF EXISTS "central-servicos-avisos-anexos: select" ON storage.objects;
DROP POLICY IF EXISTS "central-servicos-avisos-anexos: insert" ON storage.objects;
DROP POLICY IF EXISTS "central-servicos-avisos-anexos: delete" ON storage.objects;

-- Remove o bucket apenas se não houver objetos (evita perda silenciosa de dados).
DELETE FROM storage.buckets
WHERE id = 'central-servicos-avisos-anexos'
  AND NOT EXISTS (
    SELECT 1 FROM storage.objects WHERE bucket_id = 'central-servicos-avisos-anexos'
  );

DROP TABLE IF EXISTS public.central_servicos_aviso_anexos;
