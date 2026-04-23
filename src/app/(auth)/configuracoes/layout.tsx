import { SETTINGS_ROLES } from '@/config/roles'
import { requireRoleServer } from '@/lib/auth/require-role'

/**
 * Guard para /configuracoes — configurações e regras de negócio.
 * Restrito a super_admin e diretor desde v1.5.1.
 */
export default async function ConfiguracoesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(SETTINGS_ROLES)
  return <>{children}</>
}
