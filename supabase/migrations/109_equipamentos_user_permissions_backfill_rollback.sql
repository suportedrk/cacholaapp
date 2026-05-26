-- ============================================================
-- Rollback da Migration 109 — Backfill aditivo de equipamentos
--
-- Reverte o backfill removendo as linhas inseridas para diretor/gerente/
-- manutencao em (module='equipamentos', unit_id=NULL, granted=true).
--
-- ⚠ ATENÇÃO: este rollback assume que TODAS as linhas inseridas pela 109
-- tinham granted=true. Como em 2026-05-26 user_permissions estava
-- ZERADA para equipamentos antes da 109, esse rollback é seguro.
-- Em ambientes onde o backfill rodou sobre user_permissions já
-- populadas, ele pode remover linhas que coincidentemente foram criadas
-- por outros caminhos. Recomendado: snapshot do banco antes.
--
-- Idempotente.
-- ============================================================

BEGIN;

DELETE FROM public.user_permissions up
USING public.users u
WHERE up.user_id = u.id
  AND u.role IN ('diretor', 'gerente', 'manutencao')
  AND up.module = 'equipamentos'
  AND up.unit_id IS NULL
  AND up.action IN ('view','create','edit','delete')
  AND up.granted = true;

NOTIFY pgrst, 'reload schema';

COMMIT;
