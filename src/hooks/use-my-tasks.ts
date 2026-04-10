'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { ChecklistItem, ChecklistType, Priority } from '@/types/database.types'
import { useAuthReadyStore } from '@/stores/auth-store'

const RETRY = (failureCount: number, error: unknown) => {
  const status = (error as { status?: number })?.status
  if (status === 401 || status === 403) return false
  return failureCount < 2
}

// Prioridade → peso numérico para ordenação client-side
const PRIORITY_WEIGHT: Record<Priority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
}

export type MyTaskItem = ChecklistItem & {
  checklist: {
    id: string
    title: string
    type: ChecklistType
    event_id: string | null
    due_date: string | null
    event: { id: string; title: string; date: string } | null
  } | null
}

export type MyTaskFilters = {
  priority?: Priority
  overdue?: boolean
  eventId?: string
}

// ─────────────────────────────────────────────────────────────
// MINHAS TAREFAS — cross-checklist, todos os itens assigned_to=userId
// ─────────────────────────────────────────────────────────────
export function useMyTasks(userId: string | null, filters: MyTaskFilters = {}) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const { priority, overdue, eventId } = filters

  return useQuery({
    queryKey: ['my-tasks', userId, filters],
    enabled: !!userId && isSessionReady,
    retry: RETRY,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const supabase = createClient()

      let query = supabase
        .from('checklist_items')
        .select(`
          *,
          checklist:checklists!checklist_items_checklist_id_fkey(
            id, title, type, event_id, due_date,
            event:events!checklists_event_id_fkey(id, title, date)
          )
        `)
        .eq('assigned_to', userId!)
        .eq('status', 'pending')

      if (priority) query = query.eq('priority', priority)
      if (overdue)  query = query.lt('due_at', new Date().toISOString())
      if (eventId) {
        // Filtra via subquery: checklist deve ter event_id = eventId
        // Supabase não suporta filtro em FK diretamente — aplicamos client-side
      }

      // Limite de segurança — evita payload excessivo para usuários com muitas tarefas
      query = query.limit(100)

      const { data, error } = await query
      if (error) throw error

      let items = (data ?? []) as unknown as MyTaskItem[]

      // Filtro por evento (client-side, pois é join)
      if (eventId) {
        items = items.filter((i) => i.checklist?.event_id === eventId)
      }

      // Ordenação: urgência DESC → due_at ASC (nulls last) → created_at ASC
      items.sort((a, b) => {
        const pa = PRIORITY_WEIGHT[a.priority] ?? 2
        const pb = PRIORITY_WEIGHT[b.priority] ?? 2
        if (pb !== pa) return pb - pa

        const da = a.due_at ? new Date(a.due_at).getTime() : Infinity
        const db = b.due_at ? new Date(b.due_at).getTime() : Infinity
        if (da !== db) return da - db

        return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
      })

      return items
    },
  })
}

// ─────────────────────────────────────────────────────────────
// CONTAGEM DE TAREFAS CONCLUÍDAS NOS ÚLTIMOS 7 DIAS
// ─────────────────────────────────────────────────────────────
export function useMyCompletedTasksCount(userId: string | null) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['my-completed-tasks-count', userId],
    enabled: !!userId && isSessionReady,
    retry: RETRY,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createClient()
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const { count, error } = await supabase
        .from('checklist_items')
        .select('id', { count: 'exact', head: true })
        .eq('done_by', userId!)
        .eq('status', 'done')
        .gte('done_at', since)

      if (error) throw error
      return count ?? 0
    },
  })
}
