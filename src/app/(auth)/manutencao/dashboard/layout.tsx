import { MAINTENANCE_ADMIN_ROLES } from '@/config/roles'
import { requireRoleServer } from '@/lib/auth/require-role'

// D2-hold intencional: dashboard mostra dados financeiros/aprovações — porta
// administrativa que não mapeia para uma ação de módulo (view/edit/delete).
// Técnicos (manutencao) não devem acessar esta visão gerencial.
// Converter para requirePermissionServer só quando houver ação dedicada (ex: 'manage').
export default async function ManutencaoDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(MAINTENANCE_ADMIN_ROLES)
  return <>{children}</>
}
