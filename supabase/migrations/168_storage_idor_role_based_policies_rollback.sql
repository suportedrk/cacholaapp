-- ============================================================
-- ROLLBACK da Migration 168 — restaura policies originais (auth.role='authenticated')
-- ============================================================
-- Reverte para o estado pré-168: policies que checam apenas autenticação
-- (estado das migrations 021, 012 e 018b). Use apenas se a 168 causar regressão.
-- Idempotente.
-- ============================================================

-- provider-documents (origem: mig 021)
DROP POLICY IF EXISTS "provider_docs_select" ON storage.objects;
DROP POLICY IF EXISTS "provider_docs_insert" ON storage.objects;
DROP POLICY IF EXISTS "provider_docs_update" ON storage.objects;
DROP POLICY IF EXISTS "provider_docs_delete" ON storage.objects;
CREATE POLICY "provider_docs_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'provider-documents' AND auth.role() = 'authenticated');
CREATE POLICY "provider_docs_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'provider-documents' AND auth.role() = 'authenticated');
CREATE POLICY "provider_docs_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'provider-documents' AND auth.role() = 'authenticated');
CREATE POLICY "provider_docs_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'provider-documents' AND auth.role() = 'authenticated');

-- equipment-photos (origem: mig 012)
DROP POLICY IF EXISTS "equipment_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "equipment_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "equipment_photos_update" ON storage.objects;
DROP POLICY IF EXISTS "equipment_photos_delete" ON storage.objects;
CREATE POLICY "equipment_photos_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'equipment-photos' AND auth.role() = 'authenticated');
CREATE POLICY "equipment_photos_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'equipment-photos' AND auth.role() = 'authenticated');
CREATE POLICY "equipment_photos_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'equipment-photos' AND auth.role() = 'authenticated');
CREATE POLICY "equipment_photos_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'equipment-photos' AND auth.role() = 'authenticated');

-- checklist-comment-photos (origem: mig 018b)
DROP POLICY IF EXISTS "checklist_comment_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "checklist_comment_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "checklist_comment_photos_update" ON storage.objects;
DROP POLICY IF EXISTS "checklist_comment_photos_delete" ON storage.objects;
CREATE POLICY "checklist_comment_photos_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'checklist-comment-photos' AND auth.role() = 'authenticated');
CREATE POLICY "checklist_comment_photos_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'checklist-comment-photos' AND auth.role() = 'authenticated');
CREATE POLICY "checklist_comment_photos_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'checklist-comment-photos' AND auth.role() = 'authenticated');
CREATE POLICY "checklist_comment_photos_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'checklist-comment-photos' AND auth.role() = 'authenticated');

-- Remove o helper introduzido na 168 (nenhuma outra migration depende dele).
DROP FUNCTION IF EXISTS public.auth_user_has_role(text[]);
