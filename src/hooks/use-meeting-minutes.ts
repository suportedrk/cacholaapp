'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'
import { subMonths, startOfDay } from 'date-fns'
import type { MeetingMinuteForList, MeetingMinutesFilters } from '@/types/minutes'

// ─────────────────────────────────────────────────────────────
// SELECT string
// ─────────────────────────────────────────────────────────────
const MINUTES_LIST_SELECT = `
  *,
  creator:users!meeting_minutes_created_by_fkey(id, name, avatar_url),
  participants:meeting_participants(
    user_id, role,
    user:users!meeting_participants_user_id_fkey(id, name, avatar_url)
  ),
  action_items:meeting_action_items(status)
` as const

// ─────────────────────────────────────────────────────────────
// useMeetingMinutes — lista com filtros
// ─────────────────────────────────────────────────────────────
export function useMeetingMinutes(filters?: Partial<MeetingMinutesFilters>) {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const session = useAuthReadyStore((s) => s.session)

  const filtersKey = JSON.stringify(filters ?? {})

  return useQuery({
    queryKey: ['meeting-minutes', activeUnitId, filtersKey],
    enabled: isSessionReady,
    staleTime: 30 * 1000,
    retry: (count, error: unknown) => {
      const status = (error as { status?: number; code?: number })?.status
        ?? (error as { status?: number; code?: number })?.code
      if (status === 401 || status === 403) return false
      return count < 2
    },
    queryFn: async () => {
      const supabase = createClient()

      let query = supabase
        .from('meeting_minutes')
        .select(MINUTES_LIST_SELECT)
        .order('meeting_date', { ascending: false })

      if (activeUnitId) query = query.eq('unit_id', activeUnitId)

      // Status filter
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }

      // Period filter
      if (filters?.period && filters.period !== 'all') {
        const months = parseInt(filters.period, 10)
        const since = startOfDay(subMonths(new Date(), months)).toISOString()
        query = query.gte('meeting_date', since)
      }

      // onlyMine filter
      if (filters?.onlyMine && session?.user?.id) {
        query = query.eq('created_by', session.user.id)
      }

      // Search filter — ilike on title and location
      if (filters?.search) {
        const term = filters.search.trim()
        if (term) {
          query = query.or(
            `title.ilike.%${term}%,location.ilike.%${term}%`
          )
        }
      }

      const { data, error } = await query
      if (error) throw error

      return (data ?? []) as unknown as MeetingMinuteForList[]
    },
  })
}
