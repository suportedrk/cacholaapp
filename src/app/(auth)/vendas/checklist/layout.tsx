import { COMMERCIAL_CHECKLIST_ACCESS_ROLES } from '@/config/roles'
import { requireRoleServer } from '@/lib/auth/require-role'

/**
 * Guard para /vendas/checklist — módulo Checklist Comercial.
 * Restringe a super_admin, diretor, vendedora, pos_vendas.
 * Filho de /vendas (que já guarda VENDAS_MODULE_ROLES).
 */
export default async function ChecklistComercialLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(COMMERCIAL_CHECKLIST_ACCESS_ROLES)
  return <>{children}</>
}
