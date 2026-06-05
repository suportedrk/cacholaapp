import { requireRoleServer } from '@/lib/auth/require-role'
import { COMING_SOON_BYPASS_ROLES } from '@/config/roles'
import ChecklistsClient from './checklists-client'

export default async function ChecklistsPage() {
  await requireRoleServer(COMING_SOON_BYPASS_ROLES)
  return <ChecklistsClient />
}
