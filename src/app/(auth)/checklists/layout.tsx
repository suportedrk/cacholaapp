import { OPERATIONAL_CHECKLIST_ROLES } from '@/config/roles'
import { requireRoleServer } from '@/lib/auth/require-role'

/**
 * Guard para /checklists — módulo operacional de checklists.
 * pos_vendas NÃO tem acesso — foca em dados de pós-venda, não em operação.
 */
export default async function ChecklistsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(OPERATIONAL_CHECKLIST_ROLES)
  return <>{children}</>
}
