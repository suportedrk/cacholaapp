-- ============================================================
-- Migration 169 — Bucket checklist-photos: público → privado (C4)
-- ============================================================
-- Contexto (Segurança/LGPD, OWASP A01 — exposição de PII de menores):
--   O bucket `checklist-photos` foi criado como `public = TRUE` (mig 007). Como
--   as fotos de checklist podem conter crianças (PII de menor), e o path é
--   semi-previsível (userId/checklistId/itemId.ext), qualquer pessoa com a URL
--   pública lia a foto SEM autenticação e para sempre.
--
-- Correção: tornar o bucket PRIVADO. A leitura passa a exigir signed URL (1h),
-- que só um usuário autenticado consegue gerar (policy de SELECT já exige
-- auth.uid() IS NOT NULL). O app foi ajustado no mesmo PR para:
--   - gravar o PATH em checklist_items.photo_url (não mais a URL pública);
--   - exibir via signed URL (useSignedUrls), igual aos buckets irmãos.
-- Backfill (scripts/backfill-checklist-photo-paths.ts) converte as linhas
-- legadas que ainda guardam a URL pública → path.
--
-- As policies existentes (mig 007) já são adequadas para bucket privado:
--   SELECT/INSERT exigem auth.uid() IS NOT NULL; DELETE é por dono (path[1]).
-- Endurecer o SELECT por CARGO (OPERATIONAL_CHECKLIST_ROLES) fica como follow-up
-- registrado no DIVIDAS — exige verificar todos os consumidores primeiro.
--
-- Idempotente. Sem BEGIN/COMMIT nem NOTIFY pgrst (a esteira cuida).
-- ============================================================

UPDATE storage.buckets
SET public = FALSE
WHERE id = 'checklist-photos';
