'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

export type CalendarChecklist = {
  id: string
  title: string
  date: string        // 'YYYY-MM-DD' derived from due_date
  type: 'checklist'
  priority: string
  status: string
  url: string         // '/checklists/{id}'
  eventTitle?: string | null
}

// ─────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────

/**
 * Busca checklists com due_date do usuário logado para exibir no calendário.
 * Filtra: due_date IS NOT NULL, assigned_to = auth.uid(), status não concluído/cancelado.
 * Range: hoje-7 até hoje+60 dias.
 */
export function useCalendarChecklists() {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['calendar-checklists'] as const,
    queryFn: async (): Promise<CalendarChecklist[]> => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const today = new Date()
      const from = new Date(today)
      from.setDate(from.getDate() - 7)
      const to = new Date(today)
      to.setDate(to.getDate() + 60)

      const { data, error } = await supabase
        .from('checklists')
        .select('id, title, due_date, priority, status, event:events!checklists_event_id_fkey(title)')
        .not('due_date', 'is', null)
        .eq('assigned_to', user.id)
        .not('status', 'in', '(completed,cancelled)')
        .gte('due_date', from.toISOString().split('T')[0])
        .lte('due_date', to.toISOString().split('T')[0])

      if (error) throw error

      return (data ?? []).map((c) => ({
        id: c.id,
        title: c.title,
        date: (c.due_date as string).substring(0, 10),
        type: 'checklist' as const,
        priority: c.priority ?? 'medium',
        status: c.status,
        url: `/checklists/${c.id}`,
        eventTitle: (c.event as { title?: string } | null)?.title ?? null,
      }))
    },
    enabled: isSessionReady,
    staleTime: 2 * 60_000,
    networkMode: 'always',
    retry: (count, err: unknown) => {
      const status = (err as { status?: number })?.status
      if (status === 401 || status === 403) return false
      return count < 2
    },
  })
}
