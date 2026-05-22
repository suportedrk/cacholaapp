import { DECORACAO_MANAGE_ROLES } from '@/config/roles'
import { requireRoleServer } from '@/lib/auth/require-role'

/**
 * Guard do módulo Decoração (/decoracao).
 * Acesso a super_admin, diretor, gerente e decoracao.
 */
export default async function DecoracaoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(DECORACAO_MANAGE_ROLES)
  return <>{children}</>
}
