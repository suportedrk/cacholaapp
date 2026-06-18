import { requireRoleServer } from '@/lib/auth/require-role'
import { MAINTENANCE_AGENDA_ROLES } from '@/config/roles'

export default async function ManutencaoAgendaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(MAINTENANCE_AGENDA_ROLES)
  return <>{children}</>
}
