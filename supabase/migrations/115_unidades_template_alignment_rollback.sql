-- ============================================================
-- Rollback da Migration 115 — Unidades template alignment
--
-- Restaura diretor.unidades.create/edit/delete = true
-- (estado original do seed 071, antes do alinhamento).
--
-- ⚠️ Este rollback restaura um estado inconsistente onde o
-- template diz que diretor pode criar/editar/deletar unidades,
-- mas a RLS continua bloqueando essas operações via JWT.
-- Use apenas para reverter em ambiente de desenvolvimento;
-- em produção, a inconsistência foi corrigida propositalmente.
--
-- Idempotente.
-- ============================================================

BEGIN;

UPDATE public.role_permissions
SET granted    = true,
    updated_at = now()
WHERE role_code   = 'diretor'
  AND module_code = 'unidades'
  AND action IN ('create', 'edit', 'delete');

NOTIFY pgrst, 'reload schema';

COMMIT;
