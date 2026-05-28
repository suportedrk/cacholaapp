import { requirePermissionServer } from '@/lib/auth/require-permission'

export default async function ConfiguracoesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePermissionServer('configuracoes', 'view')
  return <>{children}</>
}
