import { requirePermissionServer } from '@/lib/auth/require-permission'

export default async function ManutencaoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePermissionServer('manutencao', 'view')
  return <>{children}</>
}
