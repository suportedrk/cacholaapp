'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useAuthReadyStore } from '@/stores/auth-store'
import type { MyMeetingTask, ActionItemStatus } from '@/types/minutes'

export type { MyMeetingTask }

export function useMyMeetingTasks() {
  const { profile } = useAuth()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['my-meeting-tasks'],
    enabled: isSessionReady && !!profile,
    staleTime: 30 * 1000,
    retry: (count, err: unknown) => {
      const status = (err as { status?: number })?.status
      return count < 3 && status !== 400 && status !== 401 && status !== 403
    },
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_my_action_items')
      if (error) throw error
      return (data ?? []) as MyMeetingTask[]
    },
  })
}

export function useSetMyActionItemStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ itemId, status }: { itemId: string; status: ActionItemStatus }) => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('set_my_action_item_status', {
        p_item_id: itemId,
        p_status:  status,
      })
      if (error) throw error
      return data as boolean
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-meeting-tasks'] })
    },
  })
}
