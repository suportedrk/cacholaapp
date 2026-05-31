-- ============================================================
-- Rollback da Migration 131 — Decoração Bloco C: Festa Puxa o Tema
-- Remove RPCs, policies de storage, tabelas (CASCADE derruba itens) e
-- o bucket decoracao-festa.
--
-- NOTA: o DELETE em storage.buckets falha se houver objetos no bucket.
-- Em rollback de dev local (sem uploads) é seguro. Em produção, esvaziar
-- o bucket antes (não aplicável aqui — sem deploy).
-- ============================================================

BEGIN;

DROP FUNCTION IF EXISTS public.update_festa_decoracao_itens(uuid, jsonb);
DROP FUNCTION IF EXISTS public.vincular_tema_festa(uuid, uuid);

DROP POLICY IF EXISTS "decoracao-festa: authenticated select" ON storage.objects;
DROP POLICY IF EXISTS "decoracao-festa: authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "decoracao-festa: authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "decoracao-festa: authenticated delete" ON storage.objects;

DROP TABLE IF EXISTS public.decoracao_festa_itens CASCADE;
DROP TABLE IF EXISTS public.decoracao_festa CASCADE;

DELETE FROM storage.buckets WHERE id = 'decoracao-festa';

NOTIFY pgrst, 'reload schema';

COMMIT;
