-- ============================================================
-- Rollback da Migration 108 — Equipamentos template alignment
--
-- Reverte o template do cargo manutencao para o estado pré-108:
-- só view. As ações create/edit/delete que foram concedidas na 108
-- voltam para granted=false (mantendo as linhas — o catálogo não muda).
--
-- Idempotente — rodar mais de uma vez não tem efeito colateral.
-- ============================================================

BEGIN;

UPDATE public.role_permissions
SET granted = false,
    updated_at = now()
WHERE role_code = 'manutencao'
  AND module_code = 'equipamentos'
  AND action IN ('create','edit','delete');

NOTIFY pgrst, 'reload schema';

COMMIT;
