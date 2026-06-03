-- ============================================================
-- Rollback da Migration 147 — Central de Serviços: Grupos
-- Remove a tabela de membros, o trigger/função de validação e a coluna `tipo`.
-- ============================================================

BEGIN;

DROP TABLE IF EXISTS public.central_servicos_grupo_membros CASCADE;
DROP FUNCTION IF EXISTS public.validate_grupo_membro() CASCADE;

ALTER TABLE public.central_servicos_contatos DROP COLUMN IF EXISTS tipo;

NOTIFY pgrst, 'reload schema';

COMMIT;
