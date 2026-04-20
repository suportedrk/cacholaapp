import { PRESTADORES_ACCESS_ROLES } from '@/config/roles'
import { requireRoleServer } from '@/lib/auth/require-role'

/**
 * Guard para /prestadores — gestão de prestadores de serviço.
 * Restringe a super_admin, diretor e gerente.
 * Exclui a role manutencao intencionalmente (gestão de terceiros
 * é responsabilidade de gestão, não de técnicos operacionais).
 */
export default async function PrestadoresLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(PRESTADORES_ACCESS_ROLES)
  return <>{children}</>
}
