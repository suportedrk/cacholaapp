import { ADMIN_USERS_MANAGE_ROLES } from '@/config/roles'
import { requireRoleServer } from '@/lib/auth/require-role'

/**
 * Guard para /admin/usuarios — gestão de usuários.
 * Restringe a super_admin e rh.
 */
export default async function AdminUsuariosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(ADMIN_USERS_MANAGE_ROLES)
  return <>{children}</>
}
