-- ============================================================
-- Rollback da Migration 144 — Módulo "Central de Serviços"
-- Remove o módulo do catálogo RBAC e todas as permissões concedidas.
-- Ordem inversa das FKs: user_permissions → role_default_perms →
-- role_permissions → permission_controls → modules.
-- ============================================================

BEGIN;

DELETE FROM public.user_permissions  WHERE module      = 'central_servicos';
DELETE FROM public.role_default_perms WHERE module     = 'central_servicos';
DELETE FROM public.role_permissions  WHERE module_code = 'central_servicos';
DELETE FROM public.permission_controls WHERE module_code = 'central_servicos';
DELETE FROM public.modules           WHERE code        = 'central_servicos';

NOTIFY pgrst, 'reload schema';

COMMIT;
