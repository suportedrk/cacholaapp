-- ============================================================
-- Migration 099 — Buckets de Storage para catálogos de Decoração
-- Três buckets privados (forminhas, temas, balões) com RLS no padrão
-- equipment-photos: qualquer autenticado pode SELECT/INSERT/UPDATE/DELETE.
-- ============================================================

BEGIN;

-- ── Buckets ──────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'decoracao-forminhas',
    'decoracao-forminhas',
    false,
    5242880,  -- 5 MB
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'decoracao-temas',
    'decoracao-temas',
    false,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'decoracao-baloes',
    'decoracao-baloes',
    false,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  )
ON CONFLICT (id) DO NOTHING;

-- ── RLS — decoracao-forminhas ─────────────────────────────────

CREATE POLICY "decoracao-forminhas: authenticated select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'decoracao-forminhas');

CREATE POLICY "decoracao-forminhas: authenticated insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'decoracao-forminhas');

CREATE POLICY "decoracao-forminhas: authenticated update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'decoracao-forminhas');

CREATE POLICY "decoracao-forminhas: authenticated delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'decoracao-forminhas');

-- ── RLS — decoracao-temas ─────────────────────────────────────

CREATE POLICY "decoracao-temas: authenticated select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'decoracao-temas');

CREATE POLICY "decoracao-temas: authenticated insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'decoracao-temas');

CREATE POLICY "decoracao-temas: authenticated update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'decoracao-temas');

CREATE POLICY "decoracao-temas: authenticated delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'decoracao-temas');

-- ── RLS — decoracao-baloes ────────────────────────────────────

CREATE POLICY "decoracao-baloes: authenticated select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'decoracao-baloes');

CREATE POLICY "decoracao-baloes: authenticated insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'decoracao-baloes');

CREATE POLICY "decoracao-baloes: authenticated update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'decoracao-baloes');

CREATE POLICY "decoracao-baloes: authenticated delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'decoracao-baloes');

NOTIFY pgrst, 'reload schema';

COMMIT;
