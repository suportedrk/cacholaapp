import { requirePermissionServer } from '@/lib/auth/require-permission'

export default async function ManutencaoMinhasTarefasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePermissionServer('manutencao', 'view')
  return <>{children}</>
}
