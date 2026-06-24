'use client'

import { useMemo } from 'react'
import { useMyMeetingTasks } from '@/hooks/use-my-meeting-tasks'
import type { ActionItemStatus } from '@/types/minutes'

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

export type CalendarActionItem = {
  id: string
  title: string       // description da tarefa
  date: string        // 'YYYY-MM-DD' derivado de due_date
  type: 'action_item'
  status: ActionItemStatus
  url: string         // '/atas/{meeting_id}' se participa da ata; senão '/atas/minhas-tarefas'
  meetingTitle: string
}

// ─────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────

/**
 * Prazos das tarefas (action items) atribuídas ao usuário logado, para exibir
 * no calendário do dashboard. Reaproveita a RPC `get_my_action_items` (Fase A)
 * via useMyMeetingTasks — compartilha o mesmo cache, sem chamada extra.
 *
 * Filtra: due_date presente e status != 'done' (prazo cumprido não polui a agenda).
 * O destino respeita a privacidade da Fase A: a ata completa só é linkada quando
 * o usuário pode vê-la (can_view_full); caso contrário, cai em /atas/minhas-tarefas.
 */
export function useCalendarActionItems(): { data: CalendarActionItem[]; isLoading: boolean } {
  const { data: tasks = [], isLoading } = useMyMeetingTasks()

  const data = useMemo<CalendarActionItem[]>(() => {
    return tasks
      .filter((t) => !!t.due_date && t.status !== 'done')
      .map((t) => ({
        id:           t.item_id,
        title:        t.description,
        date:         (t.due_date as string).substring(0, 10),
        type:         'action_item' as const,
        status:       t.status,
        url:          t.can_view_full ? `/atas/${t.meeting_id}` : '/atas/minhas-tarefas',
        meetingTitle: t.meeting_title,
      }))
  }, [tasks])

  return { data, isLoading }
}
