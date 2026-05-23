-- ============================================================
-- Rollback 099 — remove buckets e policies de Decoração Storage
-- AVISO: este rollback NÃO deleta os objetos dentro dos buckets.
-- Se já houver fotos enviadas, faça limpeza manual antes:
--   DELETE FROM storage.objects WHERE bucket_id IN
--     ('decoracao-forminhas','decoracao-temas','decoracao-baloes');
-- ============================================================

BEGIN;

-- Policies — decoracao-forminhas
DROP POLICY IF EXISTS "decoracao-forminhas: authenticated select" ON storage.objects;
DROP POLICY IF EXISTS "decoracao-forminhas: authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "decoracao-forminhas: authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "decoracao-forminhas: authenticated delete" ON storage.objects;

-- Policies — decoracao-temas
DROP POLICY IF EXISTS "decoracao-temas: authenticated select" ON storage.objects;
DROP POLICY IF EXISTS "decoracao-temas: authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "decoracao-temas: authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "decoracao-temas: authenticated delete" ON storage.objects;

-- Policies — decoracao-baloes
DROP POLICY IF EXISTS "decoracao-baloes: authenticated select" ON storage.objects;
DROP POLICY IF EXISTS "decoracao-baloes: authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "decoracao-baloes: authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "decoracao-baloes: authenticated delete" ON storage.objects;

-- Buckets
DELETE FROM storage.buckets
WHERE id IN ('decoracao-forminhas', 'decoracao-temas', 'decoracao-baloes');

NOTIFY pgrst, 'reload schema';

COMMIT;
