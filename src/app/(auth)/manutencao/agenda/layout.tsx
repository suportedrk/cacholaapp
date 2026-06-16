import { requireRoleServer } from '@/lib/auth/require-role'
import { MAINTENANCE_ADMIN_ROLES } from '@/config/roles'

export default async function ManutencaoAgendaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(MAINTENANCE_ADMIN_ROLES)
  return <>{children}</>
}
