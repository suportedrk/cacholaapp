import { requirePermissionServer } from '@/lib/auth/require-permission'

export default async function AtasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePermissionServer('atas', 'view')
  return <>{children}</>
}
