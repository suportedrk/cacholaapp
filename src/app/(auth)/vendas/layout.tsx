import { VENDAS_MODULE_ROLES } from '@/config/roles'
import { requireRoleServer } from '@/lib/auth/require-role'

/**
 * Guard para /vendas — módulo Vendas.
 * Restringe a super_admin, diretor, gerente e vendedora.
 */
export default async function VendasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(VENDAS_MODULE_ROLES)
  return <>{children}</>
}
