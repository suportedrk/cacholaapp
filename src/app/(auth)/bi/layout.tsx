import { BI_ACCESS_ROLES } from '@/config/roles'
import { requireRoleServer } from '@/lib/auth/require-role'

/**
 * Guard para /bi — módulo BI.
 * Restringe a super_admin, diretor, gerente e financeiro.
 */
export default async function BiLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(BI_ACCESS_ROLES)
  return <>{children}</>
}
