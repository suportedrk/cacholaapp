-- ============================================================
-- Rollback da Migration 146 — Central de Serviços: Agenda de Contatos
-- Remove a tabela, as policies de storage e o bucket privado de fotos.
-- NÃO toca no módulo RBAC central_servicos (Bloco A) nem em links (Bloco B).
-- ============================================================

BEGIN;

-- Tabela (policies + trigger caem via CASCADE)
DROP TABLE IF EXISTS public.central_servicos_contatos CASCADE;

-- Policies do storage
DROP POLICY IF EXISTS "central-servicos-contatos: select" ON storage.objects;
DROP POLICY IF EXISTS "central-servicos-contatos: insert" ON storage.objects;
DROP POLICY IF EXISTS "central-servicos-contatos: update" ON storage.objects;
DROP POLICY IF EXISTS "central-servicos-contatos: delete" ON storage.objects;

-- Objetos do bucket + bucket
DELETE FROM storage.objects WHERE bucket_id = 'central-servicos-contatos';
DELETE FROM storage.buckets WHERE id = 'central-servicos-contatos';

NOTIFY pgrst, 'reload schema';

COMMIT;
