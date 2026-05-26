-- ============================================================
-- Rollback da Migration 116 — Checklist Comercial template + backfill
--
-- Reverte:
--   1. Restaura pos_vendas.checklist_comercial.create/edit/delete = false
--      (estado original — só view era true).
--   2. Remove as linhas inseridas pela 116 em user_permissions
--      (diretor view/create/edit/delete, pos_vendas view/create/edit/delete,
--      vendedora view) com unit_id=NULL e granted=true.
--
-- ⚠ Mesmas ressalvas dos outros rollbacks de backfill: assume que as
-- linhas inseridas tinham granted=true e unit_id=NULL. Snapshot do
-- banco antes é recomendado em ambientes de produção.
--
-- Idempotente.
-- ============================================================

BEGIN;

-- 1. Restaurar template do pos_vendas (só view era true; create/edit/delete não existiam ou eram false)
UPDATE public.role_permissions
SET granted    = false,
    updated_at = now()
WHERE role_code   = 'pos_vendas'
  AND module_code = 'checklist_comercial'
  AND action IN ('create','edit','delete');

-- 2. Remover backfill de user_permissions
DELETE FROM public.user_permissions up
USING public.users u
WHERE up.user_id = u.id
  AND up.module = 'checklist_comercial'
  AND up.unit_id IS NULL
  AND up.granted = true
  AND (
    (u.role = 'diretor'    AND up.action IN ('view','create','edit','delete'))
    OR (u.role = 'pos_vendas' AND up.action IN ('view','create','edit','delete'))
    OR (u.role = 'vendedora'  AND up.action = 'view')
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
