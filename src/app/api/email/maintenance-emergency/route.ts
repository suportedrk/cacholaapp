import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { sendEmail, tplMaintenanceEmergency } from '@/lib/email'
import { requireRoleApi } from '@/lib/auth/require-role'
import { MAINTENANCE_MODULE_ROLES, MAINTENANCE_ADMIN_ROLES } from '@/config/roles'

/**
 * POST /api/email/maintenance-emergency
 * Body: { orderId: string }
 *
 * Called fire-and-forget from the maintenance mutation hook after creating
 * an emergency order. Fetches recipients, checks email preferences, sends.
 */
export async function POST(request: Request) {
  try {
    const guard = await requireRoleApi(MAINTENANCE_MODULE_ROLES)
    if (!guard.ok) return guard.response

    const { orderId } = await request.json() as { orderId?: string }
    if (!orderId) return Response.json({ error: 'orderId required' }, { status: 400 })

    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Fetch ticket
    const { data: order } = await supabase
      .from('maintenance_tickets')
      .select('title, opened_by')
      .eq('id', orderId)
      .single()

    if (!order) return Response.json({ ok: false, reason: 'ticket not found' })

    // Fetch managers + directors + quem abriu
    const { data: managers } = await supabase
      .from('users')
      .select('id, email, preferences')
      .in('role', [...MAINTENANCE_ADMIN_ROLES])
      .eq('is_active', true)

    const recipientIds = new Set<string>(
      (managers ?? []).map((u) => u.id)
    )
    if (order.opened_by) recipientIds.add(order.opened_by)

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
