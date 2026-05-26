-- ============================================================
-- Rollback da Migration 111 — Backfill aditivo de backups
--
-- Remove as linhas (user_id, NULL, 'backups', 'view', granted=true)
-- inseridas pela 111 para diretores ativos.
--
-- ⚠ Assume que as linhas inseridas pela 111 tinham granted=true e
-- unit_id=NULL. Se a 111 rodou sobre user_permissions previamente
-- populadas, o rollback pode remover linhas equivalentes criadas por
-- outros caminhos. Snapshot do banco antes é recomendado.
--
-- Idempotente.
-- ============================================================

BEGIN;

DELETE FROM public.user_permissions up
USING public.users u
WHERE up.user_id = u.id
  AND u.role = 'diretor'
  AND up.module = 'backups'
  AND up.action = 'view'
  AND up.unit_id IS NULL
  AND up.granted = true;

NOTIFY pgrst, 'reload schema';

COMMIT;
