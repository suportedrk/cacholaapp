-- Rollback Migration 104 — Itens com Variações

BEGIN;

DROP FUNCTION IF EXISTS public.create_decoracao_item_with_variacoes(text, text, uuid, text, text, boolean, jsonb);
DROP FUNCTION IF EXISTS public.update_decoracao_item_with_variacoes(uuid, text, text, uuid, text, text, boolean, jsonb);

DROP POLICY IF EXISTS "decoracao-itens: authenticated select" ON storage.objects;
DROP POLICY IF EXISTS "decoracao-itens: authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "decoracao-itens: authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "decoracao-itens: authenticated delete" ON storage.objects;

DELETE FROM storage.objects WHERE bucket_id = 'decoracao-itens';
DELETE FROM storage.buckets WHERE id = 'decoracao-itens';

DROP TABLE IF EXISTS public.decoracao_item_variacoes CASCADE;
DROP TABLE IF EXISTS public.decoracao_itens CASCADE;
DROP SEQUENCE IF EXISTS public.decoracao_variacao_codigo_seq;

NOTIFY pgrst, 'reload schema';

COMMIT;
