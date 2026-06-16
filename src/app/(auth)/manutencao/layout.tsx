import { requireRoleServer } from '@/lib/auth/require-role'
import { MAINTENANCE_MODULE_ROLES } from '@/config/roles'

export default async function ManutencaoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(MAINTENANCE_MODULE_ROLES)
  return <>{children}</>
}
