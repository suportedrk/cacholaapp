'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'
import type { ProviderKPIs } from '@/types/providers'

// ─────────────────────────────────────────────────────────────
// useProviderKpis — 5 KPI metrics in parallel
// ─────────────────────────────────────────────────────────────
export function useProviderKpis() {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['provider-kpis', activeUnitId],
    enabled: !!activeUnitId && isSessionReady,
    staleTime: 2 * 60 * 1000,
    retry: (count, error: unknown) => {
      const status = (error as { status?: number; code?: number })?.status
        ?? (error as { status?: number; code?: number })?.code
      if (status === 401 || status === 403) return false
      return count < 2
    },
    queryFn: async (): Promise<ProviderKPIs> => {
      const supabase = createClient()

      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
      const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]

      const [
        activeResult,
        ratedResult,
        expiringDocsResult,
        scheduledResult,
        pendingRatingsResult,
      ] = await Promise.all([
        // 1. Total active providers
        supabase
          .from('service_providers')
          .select('id', { count: 'exact', head: true })
          .eq('unit_id', activeUnitId!)
          .eq('status', 'active'),

        // 2. Providers with at least one rating (avg_rating > 0)
        supabase
          .from('service_providers')
          .select('avg_rating')
          .eq('unit_id', activeUnitId!)
          .eq('status', 'active')
          .gt('avg_rating', 0),

        // 3. Documents expiring in the next 30 days
        supabase
          .from('provider_documents')
          .select('id', { count: 'exact', head: true })
          .eq('unit_id', activeUnitId!)
          .lte('expires_at', in30Days)
          .gte('expires_at', now.toISOString().split('T')[0]),

        // 4. Event providers scheduled this month (not cancelled)
        supabase
          .from('event_providers')
          .select('id', { count: 'exact', head: true })
          .eq('unit_id', activeUnitId!)
          .neq('status', 'cancelled')
          .gte('created_at', monthStart)
          .lte('created_at', monthEnd),

        // 5. Completed event_providers without a rating
        supabase
          .from('event_providers')
          .select('id')
          .eq('unit_id', activeUnitId!)
          .eq('status', 'completed'),
      ])

      // Calculate average rating across all rated providers
      const ratedProviders = ratedResult.data ?? []
      const avgRating =
        ratedProviders.length > 0
          ? ratedProviders.reduce((sum, p) => sum + (p.avg_rating ?? 0), 0) /
            ratedProviders.length
          : 0

      // Determine pending ratings count
      let pendingRatingsCount = 0
      const completedIds = (pendingRatingsResult.data ?? []).map((ep) => ep.id)
      if (completedIds.length > 0) {
        const { data: ratings } = await supabase
          .from('provider_ratings')
          .select('event_provider_id')
          .in('event_provider_id', completedIds)
        const ratedIds = new Set((ratings ?? []).map((r) => r.event_provider_id))
        pendingRatingsCount = completedIds.filter((id) => !ratedIds.has(id)).length
      }

      return {
        totalActive: activeResult.count ?? 0,
        avgRating: Math.round(avgRating * 10) / 10,
        expiringDocsCount: expiringDocsResult.count ?? 0,
        scheduledThisMonth: scheduledResult.count ?? 0,
        pendingRatingsCount,
      }
    },
  })
}
