import { requirePermissionServer } from '@/lib/auth/require-permission'

export default async function PrestadoresLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePermissionServer('prestadores', 'view')
  return <>{children}</>
}
