-- ============================================================
-- Rollback da Migration 148 — Mural de Avisos + guard de troca de tipo
-- ============================================================

BEGIN;

-- Parte 1 — Avisos (policies + trigger caem via CASCADE)
DROP TABLE IF EXISTS public.central_servicos_avisos CASCADE;

-- Parte 2 — Guard da troca de tipo
DROP TRIGGER IF EXISTS trg_validate_contato_tipo_change ON public.central_servicos_contatos;
DROP FUNCTION IF EXISTS public.validate_contato_tipo_change() CASCADE;

NOTIFY pgrst, 'reload schema';

COMMIT;
