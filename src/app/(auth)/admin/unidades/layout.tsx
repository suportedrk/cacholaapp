import { ADMIN_UNITS_MANAGE_ROLES } from '@/config/roles'
import { requireRoleServer } from '@/lib/auth/require-role'

/**
 * Guard para /admin/unidades — gestão de unidades.
 * Restringe a super_admin e diretor.
 */
export default async function AdminUnidadesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(ADMIN_UNITS_MANAGE_ROLES)
  return <>{children}</>
}
