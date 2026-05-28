import { requirePermissionServer } from '@/lib/auth/require-permission'

export default async function ChecklistsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePermissionServer('checklists', 'view')
  return <>{children}</>
}
