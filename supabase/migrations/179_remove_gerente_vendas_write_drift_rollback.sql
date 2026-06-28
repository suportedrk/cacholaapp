-- ============================================================
-- Rollback da Migration 179 — restaura o drift gerente × vendas
--
-- Reinsere os grants de template que a 179 removeu (estado da mig 071).
-- As permissões individuais (user_permissions) podem ser re-materializadas
-- pelo botão "Aplicar template do cargo" em /admin/usuarios/[id]/permissoes,
-- ou via applyRoleTemplate no fluxo de troca de cargo — não as reinserimos
-- aqui em massa (não há registro de quais gerentes as tinham além do template).
-- ============================================================

INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('gerente', 'vendas', 'create', true),
  ('gerente', 'vendas', 'edit',   true)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = true;
