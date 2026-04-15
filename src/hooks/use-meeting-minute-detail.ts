'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'
import type { MeetingMinuteDetail } from '@/types/minutes'

// ─────────────────────────────────────────────────────────────
// SELECT string
// ─────────────────────────────────────────────────────────────
const MINUTE_DETAIL_SELECT = `
  *,
  creator:users!meeting_minutes_created_by_fkey(id, name, avatar_url),
  participants:meeting_participants(
    user_id, role, notified_at,
    user:users!meeting_participants_user_id_fkey(id, name, avatar_url)
  ),
  action_items:meeting_action_items(
    id, description, assigned_to, due_date, status,
    assignee:users!meeting_action_items_assigned_to_fkey(id, name, avatar_url)
  )
` as const

// ─────────────────────────────────────────────────────────────
// useMeetingMinuteDetail
// ─────────────────────────────────────────────────────────────
export function useMeetingMinuteDetail(id: string | undefined) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['meeting-minutes', 'detail', id],
    enabled: isSessionReady && !!id,
    staleTime: 30 * 1000,
    retry: (count, error: unknown) => {
      const status = (error as { status?: number })?.status
      if (status === 401 || status === 403 || status === 404) return false
      return count < 2
    },
    queryFn: async () => {
      const supabase = createClient()

      const { data, error } = await supabase
        .from('meeting_minutes')
        .select(MINUTE_DETAIL_SELECT)
        .eq('id', id!)
        .single()

      if (error) throw error

      return data as unknown as MeetingMinuteDetail
    },
  })
}
