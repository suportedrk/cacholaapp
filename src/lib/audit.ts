import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database.types'

// Lista oficial de ações e módulos de auditoria — fonte única de verdade.
// Exportada como array `as const` para servir de allowlist em runtime
// (ex.: validação do POST /api/audit), com o type derivado dela.
export const AUDIT_ACTIONS = [
  'create', 'update', 'delete', 'status_change',
  'login', 'logout', 'export',
  'activated', 'deactivated',
  'permission_changed',
  'password_reset_requested',
  'impersonate_start',
  'impersonate_stop',
] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export const AUDIT_MODULES = [
  'users', 'events', 'maintenance', 'checklists',
  'notifications', 'settings', 'auth',
] as const
export type AuditModule = (typeof AUDIT_MODULES)[number]

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
 * Usa createAdminClient (service_role) para contornar RLS.
 */
export async function logAudit(params: AuditParams): Promise<void> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const admin = await createAdminClient()
    await admin.from('audit_logs').insert({
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
