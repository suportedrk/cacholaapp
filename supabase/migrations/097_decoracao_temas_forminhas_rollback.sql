-- ============================================================
-- Rollback Migration 097 — Módulo Decoração: Temas e Forminhas
-- Remove as 3 tabelas, o registro do módulo no RBAC e os grants.
-- ============================================================

BEGIN;

-- Tabelas (ordem: dependente → referenciadas)
DROP TABLE IF EXISTS public.decoracao_tema_forminhas;
DROP TABLE IF EXISTS public.decoracao_temas;
DROP TABLE IF EXISTS public.decoracao_forminha_cores;

-- Grants de permissão
DELETE FROM public.user_permissions   WHERE module      = 'decoracao';
DELETE FROM public.role_permissions   WHERE module_code = 'decoracao';
DELETE FROM public.role_default_perms WHERE module      = 'decoracao';

-- Registro do módulo no catálogo
DELETE FROM public.modules WHERE code = 'decoracao';

NOTIFY pgrst, 'reload schema';

COMMIT;
