import { MAINTENANCE_ADMIN_ROLES } from '@/config/roles'
import { requireRoleServer } from '@/lib/auth/require-role'

// D2-hold intencional: configurações do módulo (setores, SLA, categorias) são
// porta administrativa que não mapeia para uma ação de módulo (view/edit/delete).
// Técnicos (manutencao) não devem configurar o próprio módulo.
// Converter para requirePermissionServer só quando houver ação dedicada (ex: 'manage').
export default async function ManutencaoConfiguracoesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(MAINTENANCE_ADMIN_ROLES)
  return <>{children}</>
}
