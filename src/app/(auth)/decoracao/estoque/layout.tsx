import { requireRoleServer } from '@/lib/auth/require-role'
import { DECORACAO_MANAGE_ROLES } from '@/config/roles'

export default async function EstoqueLayout({ children }: { children: React.ReactNode }) {
  await requireRoleServer(DECORACAO_MANAGE_ROLES)
  return <>{children}</>
}
