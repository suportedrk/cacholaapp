import { requirePermissionServer } from '@/lib/auth/require-permission'

/**
 * Guard da rota /decoracao/quarentena (Bloco D).
 * RBAC dourado: permissão configurável 'decoracao'.'view'. O parent
 * /decoracao/layout.tsx permanece em requireRoleServer(DECORACAO_MANAGE_ROLES)
 * até a Fase B do RBAC.
 */
export default async function DecoracaoQuarentenaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePermissionServer('decoracao', 'view')
  return <>{children}</>
}
