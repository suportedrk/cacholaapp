import { MAINTENANCE_MODULE_ROLES } from '@/config/roles'
import { requireRoleServer } from '@/lib/auth/require-role'

/**
 * Guard para /manutencao — módulo de manutenção.
 * Restringe a super_admin, diretor, gerente e manutencao.
 */
export default async function ManutencaoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(MAINTENANCE_MODULE_ROLES)
  return <>{children}</>
}
