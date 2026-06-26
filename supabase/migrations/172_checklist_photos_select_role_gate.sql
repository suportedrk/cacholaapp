-- ============================================================
-- Migration 172 — Role-gate do SELECT/INSERT do bucket checklist-photos
-- ============================================================
-- Contexto (Segurança/LGPD, OWASP A01 — hardening, follow-up do C4/mig 169):
--   A mig 169 tornou o bucket `checklist-photos` privado (grande ganho — acabou
--   a leitura por URL pública). Restou um residual: as policies de SELECT/INSERT
--   (mig 007) so exigiam `auth.uid() IS NOT NULL` → QUALQUER autenticado podia
--   mintar signed URL (ou subir foto) se soubesse/adivinhasse o path
--   (userId/checklistId/itemId.ext, semi-previsivel). Como sao fotos de festa
--   infantil (PII de menor), gateamos por CARGO.
--
--   Consumidores verificados: a foto so e lida/escrita dentro do modulo
--   /checklists (checklist-item-row, export-pdf-modal, use-checklists) — todos
--   sob OPERATIONAL_CHECKLIST_ROLES. Nenhum consumidor fora do modulo. Logo,
--   gatear SELECT+INSERT por esse role-set NAO quebra visualizador/uploader
--   legitimo. DELETE permanece owner-based (mais restritivo; mantido da mig 007).
--
--   Reusa o helper `public.auth_user_has_role(text[])` (mig 168, ja em prod). O
--   role-set espelha OPERATIONAL_CHECKLIST_ROLES de src/config/roles.ts.
--
-- Idempotente (DROP POLICY IF EXISTS + CREATE). Sem BEGIN/COMMIT nem NOTIFY
-- pgrst (a esteira cuida). Mantem os nomes de policy da mig 007.
-- ============================================================

DROP POLICY IF EXISTS "checklist_photos: authenticated read" ON storage.objects;
CREATE POLICY "checklist_photos: authenticated read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'checklist-photos'
    AND public.auth_user_has_role(ARRAY[
      'super_admin','diretor','gerente','decoracao','freelancer','entregador','operacional','operacional_eventos'
    ])
  );

DROP POLICY IF EXISTS "checklist_photos: authenticated insert" ON storage.objects;
CREATE POLICY "checklist_photos: authenticated insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'checklist-photos'
    AND public.auth_user_has_role(ARRAY[
      'super_admin','diretor','gerente','decoracao','freelancer','entregador','operacional','operacional_eventos'
    ])
  );
