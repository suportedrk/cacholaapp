import { ADMIN_LOGS_VIEW_ROLES } from '@/config/roles'
import { requireRoleServer } from '@/lib/auth/require-role'

/**
 * Guard para /admin/logs — visualização de logs de auditoria.
 * Restringe a super_admin e diretor.
 */
export default async function AdminLogsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(ADMIN_LOGS_VIEW_ROLES)
  return <>{children}</>
}
