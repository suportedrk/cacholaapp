import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database.types'

export type AuditAction =
  | 'created' | 'updated' | 'deleted'
  | 'activated' | 'deactivated'
  | 'permission_changed' | 'login' | 'logout'
  | 'password_reset_requested'

export type AuditModule =
  | 'users' | 'events' | 'maintenance' | 'checklists'
  | 'notifications' | 'settings' | 'auth'

interface AuditParams {
  action: AuditAction
  module: AuditModule
  entityId?: string
  entityType?: string
  oldData?: Json
  newData?: Json
  ip?: string
}

/**
 * Registra uma entrada no audit_log.
 * Usar em Route Handlers (Server Side) apenas.
 */
export async function logAudit(params: AuditParams): Promise<void> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('audit_logs').insert({
      user_id: user?.id ?? null,
      action: params.action,
      module: params.module,
      entity_id: params.entityId ?? null,
      entity_type: params.entityType ?? params.module,
      old_data: params.oldData ?? null,
      new_data: params.newData ?? null,
      ip: params.ip ?? null,
    })
  } catch (err) {
    // Audit failures should never break the main operation
    console.error('[audit]', err)
  }
}
