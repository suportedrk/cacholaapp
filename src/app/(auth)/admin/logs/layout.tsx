import { requirePermissionServer } from '@/lib/auth/require-permission'

export default async function AdminLogsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePermissionServer('logs', 'view')
  return <>{children}</>
}
