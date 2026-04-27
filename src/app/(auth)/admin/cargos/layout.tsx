import { TEMPLATE_MANAGE_ROLES } from '@/config/roles'
import { requireRoleServer } from '@/lib/auth/require-role'

export default async function CargosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(TEMPLATE_MANAGE_ROLES)
  return <>{children}</>
}
