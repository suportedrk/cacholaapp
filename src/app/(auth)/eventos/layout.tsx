import { requirePermissionServer } from '@/lib/auth/require-permission'

export default async function EventosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePermissionServer('eventos', 'view')
  return <>{children}</>
}
