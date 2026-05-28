import { requirePermissionServer } from '@/lib/auth/require-permission'

export default async function ConfigVendedorasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePermissionServer('vendedoras', 'edit')
  return <>{children}</>
}
