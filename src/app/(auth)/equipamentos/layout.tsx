import { requireRoleServer } from '@/lib/auth/require-role'
import { EQUIPAMENTOS_MENU_ROLES } from '@/config/roles'

export default async function EquipamentosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(EQUIPAMENTOS_MENU_ROLES)
  return <>{children}</>
}
