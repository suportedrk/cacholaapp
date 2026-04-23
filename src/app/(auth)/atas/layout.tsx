import { ATAS_ACCESS_ROLES } from '@/config/roles'
import { requireRoleServer } from '@/lib/auth/require-role'

export default async function AtasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(ATAS_ACCESS_ROLES)
  return <>{children}</>
}
