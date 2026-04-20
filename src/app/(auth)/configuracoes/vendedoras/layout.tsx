import { SELLERS_MANAGE_ROLES } from '@/config/roles'
import { requireRoleServer } from '@/lib/auth/require-role'

/**
 * Guard para /configuracoes/vendedoras — gestão de vendedoras.
 * Restringe a super_admin e diretor.
 */
export default async function ConfigVendedorasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(SELLERS_MANAGE_ROLES)
  return <>{children}</>
}
