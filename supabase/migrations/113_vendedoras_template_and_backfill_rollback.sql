-- ============================================================
-- Rollback da Migration 113 — Vendedoras template + backfill
--
-- Reverte:
--   1. Restaura diretor.vendedoras.delete = true (estado original
--      do seed 071, antes do alinhamento à realidade).
--   2. Remove as linhas (user_id, NULL, 'vendedoras', create/edit,
--      granted=true) inseridas pela 113 para diretores ativos.
--
-- ⚠ Mesmas ressalvas dos outros rollbacks de backfill: assume que
-- as linhas inseridas tinham granted=true e unit_id=NULL. Em
-- ambientes onde o backfill rodou sobre linhas pré-existentes, o
-- rollback pode remover linhas equivalentes criadas por outros
-- caminhos. Snapshot do banco antes é recomendado.
--
-- Idempotente.
-- ============================================================

BEGIN;

-- 1. Restaurar template do diretor (delete=true como no seed 071)
UPDATE public.role_permissions
SET granted = true,
    updated_at = now()
WHERE role_code = 'diretor'
  AND module_code = 'vendedoras'
  AND action = 'delete';

-- 2. Remover backfill de user_permissions para diretores ativos
DELETE FROM public.user_permissions up
USING public.users u
WHERE up.user_id = u.id
  AND u.role = 'diretor'
  AND up.module = 'vendedoras'
  AND up.action IN ('create','edit')
  AND up.unit_id IS NULL
  AND up.granted = true;

NOTIFY pgrst, 'reload schema';

COMMIT;
