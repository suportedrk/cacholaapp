import { EVENTOS_ACCESS_ROLES } from '@/config/roles'
import { requireRoleServer } from '@/lib/auth/require-role'

export default async function EventosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(EVENTOS_ACCESS_ROLES)
  return <>{children}</>
}
