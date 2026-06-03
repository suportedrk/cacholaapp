-- ============================================================
-- Migration 144 — Módulo "Central de Serviços" (fundação RBAC)
-- Bloco A: registra o módulo no catálogo RBAC e concede permissões.
-- NÃO cria tabelas de conteúdo (links/contatos/avisos vêm nos próximos blocos).
--
-- Módulo GLOBAL (sem unit_id, sem RLS por unidade): área de uso geral
-- de todos os colaboradores, igual para todas as unidades. A unidade será
-- apenas um campo informativo nos contatos (bloco futuro), nunca trava de RLS.
--
-- RBAC:
--   view               → TODOS os cargos (derivado de public.roles)
--   create/edit/delete → super_admin + diretor
--
-- Como não há tabela de conteúdo ainda, não há policy RLS a criar neste bloco:
-- o enforcement é feito pelo guard de rota (requirePermissionServer →
-- check_permission) + catálogo de permissões. As policies chegam com as
-- tabelas dos próximos blocos.
--
-- Rollback: 144_create_central_servicos_module_rollback.sql
-- ============================================================

BEGIN;

-- ── 1. Módulo no catálogo RBAC ───────────────────────────────
INSERT INTO public.modules (code, label, description, icon, sort_order, is_active)
VALUES ('central_servicos', 'Central de Serviços',
        'Área de uso geral da equipe: links úteis, contatos e mural de avisos',
        'LifeBuoy', 185, true)
ON CONFLICT (code) DO UPDATE SET
  label       = EXCLUDED.label,
  description = EXCLUDED.description,
  icon        = EXCLUDED.icon,
  sort_order  = EXCLUDED.sort_order,
  is_active   = EXCLUDED.is_active;

-- ── 2. permission_controls (ações) ──────────────────────────
-- OBRIGATÓRIO antes de role_permissions/user_permissions: ambos têm FK
-- (module_code, action) → permission_controls(module_code, code).
INSERT INTO public.permission_controls (module_code, code, label, kind, sort_order)
VALUES
  ('central_servicos', 'view',   'Visualizar', 'action', 10),
  ('central_servicos', 'create', 'Criar',      'action', 20),
  ('central_servicos', 'edit',   'Editar',     'action', 30),
  ('central_servicos', 'delete', 'Excluir',    'action', 40)
ON CONFLICT (module_code, code) DO UPDATE SET
  label      = EXCLUDED.label,
  kind       = EXCLUDED.kind,
  sort_order = EXCLUDED.sort_order;

-- ── 3. role_permissions — template canônico (/admin/cargos + applyRoleTemplate) ──
-- view → todos os cargos (derivado da tabela roles, à prova de cargos novos)
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
SELECT r.code, 'central_servicos', 'view', true
FROM public.roles r
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = EXCLUDED.granted;

-- create/edit/delete → super_admin + diretor
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
SELECT roles.r, 'central_servicos', acts.a, true
FROM (VALUES ('super_admin'), ('diretor')) AS roles(r)
CROSS JOIN (VALUES ('create'), ('edit'), ('delete')) AS acts(a)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = EXCLUDED.granted;

-- ── 4. role_default_perms — template legado (seed-local-test-users.ts) ──
INSERT INTO public.role_default_perms (role, module, action, granted)
SELECT r.code, 'central_servicos', 'view', true
FROM public.roles r
ON CONFLICT (role, module, action) DO UPDATE SET granted = EXCLUDED.granted;

INSERT INTO public.role_default_perms (role, module, action, granted)
SELECT roles.r, 'central_servicos', acts.a, true
FROM (VALUES ('super_admin'), ('diretor')) AS roles(r)
CROSS JOIN (VALUES ('create'), ('edit'), ('delete')) AS acts(a)
ON CONFLICT (role, module, action) DO UPDATE SET granted = EXCLUDED.granted;

-- ── 5. user_permissions — backfill dos usuários EXISTENTES ───
-- Módulo global → unit_id NULL. check_permission() ignora unit_id.
-- view → todos os usuários (super_admin é bypassado em check_permission;
--        incluí-lo é cosmético e inofensivo, mantém consistência com mig 097).
INSERT INTO public.user_permissions (user_id, module, action, unit_id, granted)
SELECT u.id, 'central_servicos', 'view', NULL, true
FROM public.users u
ON CONFLICT (user_id, unit_id, module, action) DO NOTHING;

-- create/edit/delete → super_admin + diretor
INSERT INTO public.user_permissions (user_id, module, action, unit_id, granted)
SELECT u.id, 'central_servicos', acts.a, NULL, true
FROM public.users u
CROSS JOIN (VALUES ('create'), ('edit'), ('delete')) AS acts(a)
WHERE u.role IN ('super_admin', 'diretor')
ON CONFLICT (user_id, unit_id, module, action) DO NOTHING;

-- ── 6. Recarregar schema do PostgREST ────────────────────────
NOTIFY pgrst, 'reload schema';

COMMIT;
