import { DESIGN_SHOWCASE_ROLES } from '@/config/roles'
import { requireRoleServer } from '@/lib/auth/require-role'

export default async function DesignLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(DESIGN_SHOWCASE_ROLES)
  return <>{children}</>
}
