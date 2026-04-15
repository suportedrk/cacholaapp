import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { tplMeetingMinuteNotification } from '@/lib/email-templates/meeting-minute-notification'

/**
 * POST /api/minutes/notify
 * Body: { meetingMinuteId: string; previousStatus?: string | null }
 *
 * Called fire-and-forget from the meeting minute mutation hooks after
 * publishing. Fetches participants, checks preferences, sends notification
 * emails and updates notified_at. Never throws — errors are logged only.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      meetingMinuteId?: string
      previousStatus?:  string | null
    }

    const { meetingMinuteId, previousStatus } = body

    if (!meetingMinuteId) {
      return Response.json({ error: 'meetingMinuteId required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // 1. Fetch the meeting minute
    const { data: minute } = await supabase
      .from('meeting_minutes')
      .select('id, title, meeting_date, location, status, created_by')
      .eq('id', meetingMinuteId)
      .single()

    if (!minute) {
      return Response.json({ error: 'Ata não encontrada' }, { status: 404 })
    }

    if (minute.status !== 'published') {
      return Response.json({ error: 'Ata não está publicada' }, { status: 400 })
    }

    // 2. Skip if ata was already published before (avoid re-notification spam)
    //    Only notify on the transition to published (previousStatus was draft or null)
    if (previousStatus === 'published') {
      return Response.json({ ok: true, notified: 0, reason: 'already published' })
    }

    // 3. Fetch participants with user emails
    const { data: participants } = await supabase
      .from('meeting_participants')
      .select('user_id, notified_at, user:users!meeting_participants_user_id_fkey(id, name, email, preferences)')
      .eq('meeting_id', meetingMinuteId)

    // 4. Fetch creator name
    const { data: creator } = await supabase
      .from('users')
      .select('name')
      .eq('id', minute.created_by)
      .single()

    const creatorName = creator?.name ?? 'Um membro da equipe'

    // 5. Format date for email (pt-BR)
    const meetingDate = new Date(minute.meeting_date + 'T00:00:00').toLocaleDateString('pt-BR', {
      weekday: 'long',
      day:     'numeric',
      month:   'long',
      year:    'numeric',
    })

    // 6. Count totals for summary card
    const participantCount = (participants ?? []).length

    const { count: actionItemCount } = await supabase
      .from('meeting_action_items')
      .select('id', { count: 'exact', head: true })
      .eq('meeting_id', meetingMinuteId)

    // 7. Send to each eligible participant
    let notified = 0

    for (const p of participants ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const user = (p as any).user as { id: string; name: string; email: string | null; preferences: unknown } | null
      if (!user) continue

      // Exclude the creator (they just published it)
      if (user.id === minute.created_by) continue

      // Require a valid email
      if (!user.email) continue

      // Respect email notification preferences
      const prefs = user.preferences as { notifications?: { email?: boolean } } | null
      if (prefs?.notifications?.email === false) continue

      try {
        const { subject, html } = tplMeetingMinuteNotification({
          participantName:  user.name,
          creatorName,
          title:            minute.title,
          meetingDate,
          location:         minute.location,
          participantCount,
          actionItemCount:  actionItemCount ?? 0,
          minuteId:         minute.id,
        })

        await sendEmail(user.email, subject, html)

        // Update notified_at for this participant
        await supabase
          .from('meeting_participants')
          .update({ notified_at: new Date().toISOString() })
          .eq('meeting_id', meetingMinuteId)
          .eq('user_id', user.id)

        notified++
      } catch (err) {
        console.error(`[minutes/notify] Falha ao notificar ${user.email}:`, err)
        // Continue with remaining participants
      }
    }

    return Response.json({ ok: true, notified })
  } catch (err) {
    console.error('[minutes/notify]', err)
    return Response.json({ ok: false }, { status: 500 })
  }
}
