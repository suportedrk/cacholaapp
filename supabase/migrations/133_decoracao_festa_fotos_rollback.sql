-- Rollback da Migration 133 — Decoração Bloco E: Fotos da Montagem
BEGIN;
DROP TABLE IF EXISTS public.decoracao_festa_fotos CASCADE;
NOTIFY pgrst, 'reload schema';
COMMIT;
