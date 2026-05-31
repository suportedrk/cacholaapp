import { requirePermissionServer } from '@/lib/auth/require-permission'

/**
 * Guard da rota /decoracao/itens (cobre listagem, /nova e /[id]).
 * Convert-as-we-touch (A2): usa permissão configurável, não cargo fixo.
 * O parent /decoracao/layout.tsx permanece em requireRoleServer(DECORACAO_MANAGE_ROLES)
 * — será convertido na Fase B do RBAC.
 */
export default async function DecoracaoItensLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePermissionServer('decoracao', 'view')
  return <>{children}</>
}
