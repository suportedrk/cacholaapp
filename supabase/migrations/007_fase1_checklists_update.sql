-- ============================================================
-- Cachola OS — Migration 007: Atualização do Módulo Checklists (Fase 1)
-- ============================================================
-- Alterações:
--   1. checklist_items: adiciona coluna `status` (pending|done|na)
--   2. checklist_templates: adiciona FK category_id → checklist_categories
--   3. Supabase Storage: cria bucket 'checklist-photos'
-- Execute com:
--   docker exec cacholaos-db bash -c "psql -U postgres -d postgres -f /docker-entrypoint-migrations/007_fase1_checklists_update.sql"
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. checklist_items: coluna `status`
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.checklist_items
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'done', 'na'));

-- Migrar dados existentes: is_done=true → status='done'
UPDATE public.checklist_items
  SET status = 'done'
  WHERE is_done = TRUE AND status = 'pending';

-- Índice para filtros por status
CREATE INDEX IF NOT EXISTS idx_checklist_items_status
  ON public.checklist_items(status);

-- ─────────────────────────────────────────────────────────────
-- 2. checklist_templates: FK para category
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.checklist_templates
  ADD COLUMN IF NOT EXISTS category_id UUID
    REFERENCES public.checklist_categories(id) ON DELETE SET NULL;

-- Migrar dados existentes: tentar mapear category (TEXT) → category_id
-- Faz update apenas quando o nome der match
UPDATE public.checklist_templates t
  SET category_id = c.id
  FROM public.checklist_categories c
  WHERE lower(t.category) = lower(c.name)
    AND t.category_id IS NULL;

-- Índice para filtros por categoria
CREATE INDEX IF NOT EXISTS idx_checklist_templates_category_id
  ON public.checklist_templates(category_id);

-- ─────────────────────────────────────────────────────────────
-- 3. Supabase Storage: bucket checklist-photos
-- ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'checklist-photos',
  'checklist-photos',
  TRUE,
  10485760,  -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- RLS para o storage bucket (usuários autenticados podem ler/escrever)
CREATE POLICY "checklist_photos: authenticated read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'checklist-photos'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "checklist_photos: authenticated insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'checklist-photos'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "checklist_photos: owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'checklist-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
