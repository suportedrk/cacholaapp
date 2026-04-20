import { BI_ACCESS_ROLES } from '@/config/roles'
import { requireRoleServer } from '@/lib/auth/require-role'

/**
 * Guard para /relatorios.
 * Restringe a super_admin, diretor, gerente e financeiro.
 * Reutiliza BI_ACCESS_ROLES (mesma audiência do módulo BI).
 */
export default async function RelatoriosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(BI_ACCESS_ROLES)
  return <>{children}</>
}
