import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { sendEmail, tplMaintenanceEmergency } from '@/lib/email'
import { requirePermissionApi } from '@/lib/auth/require-permission'
import { MAINTENANCE_ADMIN_ROLES } from '@/config/roles'

/**
 * POST /api/email/maintenance-emergency
 * Body: { orderId: string }
 *
 * Called fire-and-forget from the maintenance mutation hook after creating
 * an emergency order. Fetches recipients, checks email preferences, sends.
 */
export async function POST(request: Request) {
  try {
    const guard = await requirePermissionApi('manutencao', 'view')
    if (!guard.ok) return guard.response

    const { orderId } = await request.json() as { orderId?: string }
    if (!orderId) return Response.json({ error: 'orderId required' }, { status: 400 })

    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Fetch ticket — created_by_user_id é o criador REAL (técnico), destinatário
    // correto do alerta. opened_by agora é o solicitante (pode ser não-técnico).
    const { data: order } = await supabase
      .from('maintenance_tickets')
      .select('title, created_by_user_id')
      .eq('id', orderId)
      .single()

    if (!order) return Response.json({ ok: false, reason: 'ticket not found' })

    // Fetch managers + directors + criador real
    const { data: managers } = await supabase
      .from('users')
      .select('id, email, preferences')
      .in('role', [...MAINTENANCE_ADMIN_ROLES])
      .eq('is_active', true)

    const recipientIds = new Set<string>(
      (managers ?? []).map((u) => u.id)
    )
    if (order.created_by_user_id) recipientIds.add(order.created_by_user_id)

    // Resolve emails + check preferences
    const { data: users } = await supabase
      .from('users')
      .select('email, preferences')
      .in('id', Array.from(recipientIds))

    const toList = (users ?? [])
      .filter((u) => {
        const prefs = u.preferences as { notifications?: { email?: boolean } } | null
        return prefs?.notifications?.email !== false
      })
      .map((u) => u.email)

    if (toList.length === 0) return Response.json({ ok: true, sent: 0 })

    const { subject, html } = tplMaintenanceEmergency({ orderTitle: order.title, orderId })
    await sendEmail(toList, subject, html)

    return Response.json({ ok: true, sent: toList.length })
  } catch (err) {
    console.error('[email/maintenance-emergency]', err)
    return Response.json({ ok: false }, { status: 500 })
  }
}
