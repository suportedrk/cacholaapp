'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'
import { useUnitStore } from '@/stores/unit-store'
import { useUnitUsers } from '@/hooks/use-units'
import type { Priority } from '@/types/database.types'

const RETRY = (failureCount: number, error: unknown) => {
  const status = (error as { status?: number })?.status
  if (status === 400 || status === 401 || status === 403) return false
  return failureCount < 2
}

export type TeamTaskItem = {
  id: string
  description: string | null
  status: string
  priority: Priority
  due_at: string | null
  assigned_to: string | null
  estimated_minutes: number | null
  checklist: {
    id: string
    title: string
    type: string
    event: { id: string; title: string; date: string } | null
  } | null
}

export function useTeamTasks(filterUserId?: string) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const activeUnitId = useUnitStore((s) => s.activeUnitId)
  const { data: unitUsers } = useUnitUsers(activeUnitId ?? undefined)

  const memberIds = filterUserId
    ? [filterUserId]
    : (unitUsers ?? []).map((u) => u.user?.id).filter(Boolean) as string[]

  return useQuery({
    queryKey: ['team-tasks', activeUnitId, filterUserId],
    enabled: isSessionReady && memberIds.length > 0,
    staleTime: 2 * 60 * 1000,
    retry: RETRY,
    queryFn: async () => {
      const supabase = createClient()

      const { data, error } = await supabase
        .from('checklist_items')
        .select(`
          id, description, status, priority, due_at, assigned_to, estimated_minutes,
          checklist:checklists!checklist_items_checklist_id_fkey(
            id, title, type,
            event:events!checklists_event_id_fkey(id, title, date)
          )
        `)
        .in('assigned_to', memberIds)
        .eq('status', 'pending')
        .limit(200)
        .order('due_at', { ascending: true, nullsFirst: false })

      if (error) throw error
      return (data ?? []) as unknown as TeamTaskItem[]
    },
  })
}

export function useTeamCompletedCount(unitId: string | null) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const { data: unitUsers } = useUnitUsers(unitId ?? undefined)

  const memberIds = (unitUsers ?? []).map((u) => u.user?.id).filter(Boolean) as string[]

  return useQuery({
    queryKey: ['team-completed-count', unitId],
    enabled: isSessionReady && !!unitId && memberIds.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: RETRY,
    queryFn: async () => {
      const supabase = createClient()
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const { count, error } = await supabase
        .from('checklist_items')
        .select('id', { count: 'exact', head: true })
        .in('assigned_to', memberIds)
        .eq('status', 'done')
        .gte('done_at', since)

      if (error) throw error
      return count ?? 0
    },
  })
}
