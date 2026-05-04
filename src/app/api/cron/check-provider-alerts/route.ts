import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import {
  notifyProviderDocExpiring,
  notifyProviderDocExpired,
  notifyProviderRatingPending,
} from '@/lib/notifications'
import { PROVIDER_NOTIFY_ROLES } from '@/config/roles'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─────────────────────────────────────────────────────────────
// GET /api/cron/check-provider-alerts
// Protected by CRON_SECRET
// ─────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const now = new Date()
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const results = {
    docsExpiring: 0,
    docsExpired: 0,
    ratingsPending: 0,
    errors: [] as string[],
  }

  // ── 1. Expiring docs (within 30 days, not yet expired, alert not sent) ──
  const { data: expiringDocs, error: expiringErr } = await supabase
    .from('provider_documents')
    .select('id, name, provider_id, expires_at')
    .lte('expires_at', thirtyDaysLater.toISOString())
    .gte('expires_at', now.toISOString())
    .eq('expiry_alert_sent', false)

  if (expiringErr) {
    results.errors.push(`expiringDocs: ${expiringErr.message}`)
  } else if (expiringDocs && expiringDocs.length > 0) {
    const providerIds = [...new Set(expiringDocs.map((d) => d.provider_id))]
    const { data: providers } = await supabase
      .from('service_providers')
      .select('id, name, unit_id')
      .in('id', providerIds)

    const providerMap = new Map((providers ?? []).map((p) => [p.id, p]))

    for (const doc of expiringDocs) {
      const provider = providerMap.get(doc.provider_id)
      if (!provider) continue

      const expiresAt = new Date(doc.expires_at!)
      const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      const { data: unitUsers } = await supabase
        .from('user_units')
        .select('user_id')
        .eq('unit_id', provider.unit_id)
        .in('role', [...PROVIDER_NOTIFY_ROLES])

      for (const { user_id } of unitUsers ?? []) {
        try {
          await notifyProviderDocExpiring(supabase, user_id, provider.name, doc.name, daysLeft, provider.id)
        } catch { /* non-critical */ }
      }

      await supabase.from('provider_documents').update({ expiry_alert_sent: true }).eq('id', doc.id)
      results.docsExpiring++
    }
  }

  // ── 2. Expired docs (past today, alert not sent) ──
  const { data: expiredDocs, error: expiredErr } = await supabase
    .from('provider_documents')
    .select('id, name, provider_id, expires_at')
    .lt('expires_at', now.toISOString())
    .eq('expiry_alert_sent', false)

  if (expiredErr) {
    results.errors.push(`expiredDocs: ${expiredErr.message}`)
  } else if (expiredDocs && expiredDocs.length > 0) {
    const providerIds = [...new Set(expiredDocs.map((d) => d.provider_id))]
    const { data: providers } = await supabase
      .from('service_providers')
      .select('id, name, unit_id')
      .in('id', providerIds)

    const providerMap = new Map((providers ?? []).map((p) => [p.id, p]))

    for (const doc of expiredDocs) {
      const provider = providerMap.get(doc.provider_id)
      if (!provider) continue

      const { data: unitUsers } = await supabase
        .from('user_units')
        .select('user_id')
        .eq('unit_id', provider.unit_id)
        .in('role', [...PROVIDER_NOTIFY_ROLES])

      for (const { user_id } of unitUsers ?? []) {
        try {
          await notifyProviderDocExpired(supabase, user_id, provider.name, doc.name, provider.id)
        } catch { /* non-critical */ }
      }

      await supabase.from('provider_documents').update({ expiry_alert_sent: true }).eq('id', doc.id)
      results.docsExpired++
    }
  }

  // ── 3. Pending rating alerts (completed 24–48h ago, no rating yet) ──
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000)

  const { data: pendingEps, error: pendingErr } = await supabase
    .from('event_providers')
    .select('id, unit_id, provider_id, event_id')
    .eq('status', 'completed')
    .gte('updated_at', twoDaysAgo.toISOString())
    .lt('updated_at', oneDayAgo.toISOString())

  if (pendingErr) {
    results.errors.push(`pendingRatings: ${pendingErr.message}`)
  } else if (pendingEps && pendingEps.length > 0) {
    // Filter out those already rated
    const epIds = pendingEps.map((ep) => ep.id)
    const { data: existingRatings } = await supabase
      .from('provider_ratings')
      .select('event_provider_id')
      .in('event_provider_id', epIds)

    const ratedEpIds = new Set((existingRatings ?? []).map((r) => r.event_provider_id))
    const unrated = pendingEps.filter((ep) => !ratedEpIds.has(ep.id))

    if (unrated.length > 0) {
      const providerIds = [...new Set(unrated.map((ep) => ep.provider_id))]
      const eventIds = [...new Set(unrated.map((ep) => ep.event_id))]

      const [{ data: providers }, { data: events }] = await Promise.all([
        supabase.from('service_providers').select('id, name').in('id', providerIds),
        supabase.from('events').select('id, title, birthday_person').in('id', eventIds),
      ])

      const providerMap = new Map((providers ?? []).map((p) => [p.id, p]))
      const eventMap = new Map((events ?? []).map((e) => [e.id, e]))

      for (const ep of unrated) {
        const provider = providerMap.get(ep.provider_id)
        const event = eventMap.get(ep.event_id)
        if (!provider || !event) continue

        const eventTitle = (event as { birthday_person?: string | null; title?: string | null }).birthday_person
          || event.title
          || 'Evento'

        const { data: unitUsers } = await supabase
          .from('user_units')
          .select('user_id')
          .eq('unit_id', ep.unit_id)
          .in('role', [...PROVIDER_NOTIFY_ROLES])

        for (const { user_id } of unitUsers ?? []) {
          try {
            await notifyProviderRatingPending(supabase, user_id, provider.name, eventTitle, ep.event_id)
          } catch { /* non-critical */ }
        }

        results.ratingsPending++
      }
    }
  }

  return NextResponse.json({ ok: true, ...results, timestamp: now.toISOString() })
}
