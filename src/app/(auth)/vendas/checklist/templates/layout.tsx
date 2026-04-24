import { COMMERCIAL_CHECKLIST_MANAGE_ROLES } from '@/config/roles'
import { requireRoleServer } from '@/lib/auth/require-role'

/**
 * Guard para /vendas/checklist/templates — gestão de templates.
 * Restringe a super_admin, diretor.
 * Filho de /vendas/checklist (que já guarda COMMERCIAL_CHECKLIST_ACCESS_ROLES).
 * Herdado por /templates/[id].
 */
export default async function TemplatesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleServer(COMMERCIAL_CHECKLIST_MANAGE_ROLES)
  return <>{children}</>
}
