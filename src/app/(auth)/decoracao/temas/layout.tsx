import { requirePermissionServer } from '@/lib/auth/require-permission'

/**
 * Guard da rota /decoracao/temas (listagem + edição via sheet).
 * Convert-as-we-touch (Bloco B): usa permissão configurável, não cargo fixo.
 * O parent /decoracao/layout.tsx permanece em requireRoleServer(DECORACAO_MANAGE_ROLES)
 * — será convertido na Fase B do RBAC.
 */
export default async function DecoracaoTemasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePermissionServer('decoracao', 'view')
  return <>{children}</>
}
