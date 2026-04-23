import { DASHBOARD_ACCESS_ROLES } from '@/config/roles'
import { requireRoleServer } from '@/lib/auth/require-role'

/**
 * Guard para /dashboard — freelancer e entregador são redirecionados
 * para /checklists/minhas-tarefas já no pós-login; este guard é
 * a camada de segurança server-side caso acessem diretamente.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(DASHBOARD_ACCESS_ROLES)
  return <>{children}</>
}
