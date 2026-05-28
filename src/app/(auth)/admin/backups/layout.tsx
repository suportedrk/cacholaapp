import { requirePermissionServer } from '@/lib/auth/require-permission'

export default async function BackupsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePermissionServer('backups', 'view')
  return <>{children}</>
}
