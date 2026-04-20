import { ADMIN_ACCESS_ROLES } from '@/config/roles'
import { requireRoleServer } from '@/lib/auth/require-role'

/**
 * Layout de Server Component para a área /admin.
 *
 * Permite acesso apenas para super_admin, diretor e rh.
 * Cada sub-rota tem seu próprio layout para granularidade adicional:
 *   /admin/usuarios → ADMIN_USERS_MANAGE_ROLES (super_admin, rh)
 *   /admin/unidades → ADMIN_UNITS_MANAGE_ROLES (super_admin, diretor)
 *   /admin/logs     → ADMIN_LOGS_VIEW_ROLES    (super_admin, diretor)
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(ADMIN_ACCESS_ROLES)
  return <>{children}</>
}
