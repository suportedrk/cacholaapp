-- ============================================================
-- Migration 179 — Remove o drift gerente × vendas (create/edit)
--
-- O template RBAC (mig 071) concede a gerente `vendas:create` e `vendas:edit`,
-- MAS gerente NÃO tem `vendas:view` (removido) e não acessa /vendas. São grants
-- órfãos. Passaram a importar com a mig 178: a RLS de `sales_targets` usa
-- `check_permission('vendas','edit')`, então um gerente poderia, via PostgREST
-- direto, escrever meta. A decisão de produto é metas = super_admin + diretor
-- (o endpoint /api/vendas/targets já é role-gated; isto alinha a camada de dados).
--
-- `vendas:edit`/`vendas:create` não são consumidos por mais nada (só a RLS da
-- 178 e o layout usa `vendas:view`) → remoção sem colateral.
--
-- Convenção da esteira (160+): SEM BEGIN/COMMIT e SEM NOTIFY pgrst soltos.
-- Rollback: 179_remove_gerente_vendas_write_drift_rollback.sql
-- ============================================================

-- 1. Template canônico
DELETE FROM public.role_permissions
WHERE role_code = 'gerente'
  AND module_code = 'vendas'
  AND action IN ('create', 'edit');

-- 2. Permissões individuais já materializadas para gerentes existentes
DELETE FROM public.user_permissions up
USING public.users u
WHERE up.user_id = u.id
  AND u.role = 'gerente'
  AND up.module = 'vendas'
  AND up.action IN ('create', 'edit');
