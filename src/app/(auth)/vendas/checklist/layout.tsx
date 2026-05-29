import { requirePermissionServer } from '@/lib/auth/require-permission'

/**
 * Guard para /vendas/checklist — módulo Checklist Comercial.
 * Governado por permissão configurável: check_permission(uid, 'checklist_comercial', 'view').
 * O toggle em /admin/cargos passa a controlar o acesso à rota (Fase 3).
 * Filho de /vendas (que já guarda VENDAS_MODULE_ROLES — barra cargos fora dele,
 * ex.: gerente, mesmo que tenha view granted em user_permissions).
 */
export default async function ChecklistComercialLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePermissionServer('checklist_comercial', 'view')
  return <>{children}</>
}
