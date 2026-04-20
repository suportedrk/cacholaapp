import { MAINTENANCE_MODULE_ROLES } from '@/config/roles'
import { requireRoleServer } from '@/lib/auth/require-role'

/**
 * Guard para /equipamentos — gestão de ativos.
 * Restringe a super_admin, diretor, gerente e manutencao.
 * Usa MAINTENANCE_MODULE_ROLES (mesmo conjunto de /manutencao).
 */
export default async function EquipamentosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(MAINTENANCE_MODULE_ROLES)
  return <>{children}</>
}
