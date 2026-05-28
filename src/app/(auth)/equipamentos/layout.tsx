import { requirePermissionServer } from '@/lib/auth/require-permission'

export default async function EquipamentosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePermissionServer('equipamentos', 'view')
  return <>{children}</>
}
