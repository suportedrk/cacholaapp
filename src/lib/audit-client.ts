/**
 * auditLog — helper client-side para registrar ações no audit_log.
 * Fire-and-forget: nunca bloqueia a operação principal.
 * Chama POST /api/audit que usa service_role para contornar RLS.
 */
export function auditLog(params: {
  action: string
  module: string
  entityId?: string
  entityType?: string
  oldData?: Record<string, unknown>
  newData?: Record<string, unknown>
}): void {
  fetch('/api/audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  }).catch(() => {/* audit failures are non-critical */})
}
