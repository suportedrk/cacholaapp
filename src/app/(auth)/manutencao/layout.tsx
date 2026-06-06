import { requireRoleServer } from '@/lib/auth/require-role'
import { COMING_SOON_BYPASS_ROLES } from '@/config/roles'

export default async function ManutencaoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(COMING_SOON_BYPASS_ROLES)
  return <>{children}</>
}
