import { MAINTENANCE_ADMIN_ROLES } from '@/config/roles'
import { requireRoleServer } from '@/lib/auth/require-role'

/**
 * Guard para /manutencao/configuracoes — visão gerencial, exclui técnicos (manutencao).
 */
export default async function ManutencaoConfiguracoesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(MAINTENANCE_ADMIN_ROLES)
  return <>{children}</>
}
