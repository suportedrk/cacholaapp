import { MAINTENANCE_ADMIN_ROLES } from '@/config/roles'
import { requireRoleServer } from '@/lib/auth/require-role'

/**
 * Guard para /manutencao/dashboard — visão gerencial, exclui técnicos (manutencao).
 */
export default async function ManutencaoDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(MAINTENANCE_ADMIN_ROLES)
  return <>{children}</>
}
