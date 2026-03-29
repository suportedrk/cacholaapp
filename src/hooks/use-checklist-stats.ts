'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Priority } from '@/types/database.types'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'

const RETRY = (failureCount: number, error: unknown) => {
  const status = (error as { status?: number })?.status
  if (status === 401 || status === 403) return false
  return failureCount < 2
}

export type ChecklistStats = {
  total: number
  pending: number
  in_progress: number
  completed: number
  cancelled: number
  overdue: number
  completedToday: number
  completedThisWeek: number
  avgCompletionHours: number | null
  byPriority: { priority: Priority; count: number }[]
  byCategory: { category: string; count: number }[]
}

// ─────────────────────────────────────────────────────────────
// KPIs AGREGADOS DA UNIDADE
// ─────────────────────────────────────────────────────────────
export function useChecklistStats() {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['checklist-stats', activeUnitId],
    enabled: !!activeUnitId && isSessionReady,
    retry: RETRY,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ChecklistStats> => {
      const supabase = createClient()
      const now = new Date()
      const todayStart = new Date(now)
      todayStart.setHours(0, 0, 0, 0)
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - now.getDay())  // domingo da semana
      weekStart.setHours(0, 0, 0, 0)

      // Query base
      const base = supabase
        .from('checklists')
        .select('id, status, priority, due_date, completed_at, created_at, template_id', { count: 'exact' })

      // 4 queries paralelas
      const [allRes, overdueRes, todayRes, weekRes] = await Promise.all([
        // Todos (para contadores por status e priority)
        base.eq('unit_id', activeUnitId!),

        // Atrasados: pending/in_progress com due_date < now
        supabase
          .from('checklists')
          .select('id', { count: 'exact' })
          .eq('unit_id', activeUnitId!)
          .in('status', ['pending', 'in_progress'])
          .lt('due_date', now.toISOString())
          .not('due_date', 'is', null),

        // Concluídos hoje
        supabase
          .from('checklists')
          .select('id', { count: 'exact' })
          .eq('unit_id', activeUnitId!)
          .eq('status', 'completed')
          .gte('completed_at', todayStart.toISOString()),

        // Concluídos esta semana
        supabase
          .from('checklists')
          .select('id', { count: 'exact' })
          .eq('unit_id', activeUnitId!)
          .eq('status', 'completed')
          .gte('completed_at', weekStart.toISOString()),
      ])

      if (allRes.error) throw allRes.error

      const all = allRes.data ?? []

      // Contadores por status
      const byStatus = {
        total: allRes.count ?? 0,
        pending: all.filter((c) => c.status === 'pending').length,
        in_progress: all.filter((c) => c.status === 'in_progress').length,
        completed: all.filter((c) => c.status === 'completed').length,
        cancelled: all.filter((c) => c.status === 'cancelled').length,
      }

      // Contadores por prioridade
      const priorityMap = new Map<Priority, number>()
      for (const c of all) {
        const p = (c.priority ?? 'medium') as Priority
        priorityMap.set(p, (priorityMap.get(p) ?? 0) + 1)
      }
      const byPriority = (['urgent', 'high', 'medium', 'low'] as Priority[])
        .map((priority) => ({ priority, count: priorityMap.get(priority) ?? 0 }))
        .filter((x) => x.count > 0)

      // Tempo médio de conclusão (horas) — apenas checklists com created_at + completed_at
      const completedWithDates = all.filter(
        (c) => c.status === 'completed' && c.completed_at && c.created_at
      )
      let avgCompletionHours: number | null = null
      if (completedWithDates.length > 0) {
        const totalMs = completedWithDates.reduce((sum, c) => {
          const ms = new Date(c.completed_at!).getTime() - new Date(c.created_at).getTime()
          return sum + (ms > 0 ? ms : 0)
        }, 0)
        avgCompletionHours = Math.round(totalMs / completedWithDates.length / 3_600_000 * 10) / 10
      }

      // Por categoria — via template_id
      const templateIds = [...new Set(all.map((c) => c.template_id).filter(Boolean))] as string[]
      let byCategory: { category: string; count: number }[] = []

      if (templateIds.length > 0) {
        const { data: tplData } = await supabase
          .from('checklist_templates')
          .select('id, category_id, category:checklist_categories!checklist_templates_category_id_fkey(name)')
          .in('id', templateIds)

        const catMap = new Map<string, string>()
        for (const t of tplData ?? []) {
          const catName = (t.category as unknown as { name: string } | null)?.name ?? 'Sem categoria'
          catMap.set(t.id, catName)
        }

        const catCount = new Map<string, number>()
        for (const c of all) {
          const cat = c.template_id ? (catMap.get(c.template_id) ?? 'Sem categoria') : 'Sem categoria'
          catCount.set(cat, (catCount.get(cat) ?? 0) + 1)
        }

        byCategory = [...catCount.entries()]
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => b.count - a.count)
      }

      return {
        ...byStatus,
        overdue: overdueRes.count ?? 0,
        completedToday: todayRes.count ?? 0,
        completedThisWeek: weekRes.count ?? 0,
        avgCompletionHours,
        byPriority,
        byCategory,
      }
    },
  })
}
