import { BACKUP_VIEW_ROLES } from '@/config/roles'
import { requireRoleServer } from '@/lib/auth/require-role'

export default async function BackupsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(BACKUP_VIEW_ROLES)
  return <>{children}</>
}
