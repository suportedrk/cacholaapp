'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { ChecklistRecurrence } from '@/types/database.types'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'
import { calcNextGenerationAt } from '@/lib/utils/checklist-recurrence'

const RETRY = (failureCount: number, error: unknown) => {
  const status = (error as { status?: number })?.status
  if (status === 401 || status === 403) return false
  return failureCount < 2
}

// ─────────────────────────────────────────────────────────────
// LISTAR REGRAS DE RECORRÊNCIA DA UNIDADE
// ─────────────────────────────────────────────────────────────
export function useChecklistRecurrences(onlyActive = true) {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['checklist-recurrences', activeUnitId, onlyActive],
    enabled: isSessionReady,
    retry: RETRY,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const supabase = createClient()
      let query = supabase
        .from('checklist_recurrence')
        .select(`
          *,
          template:checklist_templates!checklist_recurrence_template_id_fkey(id, title, category_id),
          assigned_user:users!checklist_recurrence_assigned_to_fkey(id, name, avatar_url)
        `)
        .order('next_generation_at', { ascending: true, nullsFirst: false })

      if (activeUnitId) query = query.eq('unit_id', activeUnitId)
      if (onlyActive) query = query.eq('is_active', true)

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as unknown as ChecklistRecurrence[]
    },
  })
}

// ─────────────────────────────────────────────────────────────
// CRIAR REGRA DE RECORRÊNCIA
// ─────────────────────────────────────────────────────────────
export function useCreateRecurrence() {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async ({
      templateId,
      frequency,
      dayOfWeek,
      dayOfMonth,
      timeOfDay = '08:00',
      assignedTo,
      titlePrefix,
      description,
      createdBy,
    }: {
      templateId: string
      frequency: ChecklistRecurrence['frequency']
      dayOfWeek?: number[]
      dayOfMonth?: number
      timeOfDay?: string
      assignedTo?: string
      titlePrefix?: string
      description?: string
      createdBy?: string
    }) => {
      const supabase = createClient()

      const nextGenerationAt = calcNextGenerationAt(
        frequency,
        dayOfWeek,
        dayOfMonth,
        timeOfDay
      )

      const { data, error } = await supabase
        .from('checklist_recurrence')
        .insert({
          template_id: templateId,
          unit_id: activeUnitId!,
          frequency,
          day_of_week: dayOfWeek ?? null,
          day_of_month: dayOfMonth ?? null,
          time_of_day: timeOfDay + ':00',  // TIME format HH:MM:SS
          assigned_to: assignedTo ?? null,
          title_prefix: titlePrefix ?? null,
          description: description ?? null,
          created_by: createdBy ?? null,
          is_active: true,
          next_generation_at: nextGenerationAt,
        })
        .select('id')
        .single()

      if (error) throw error
      return data.id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['checklist-recurrences'] })
      toast.success('Recorrência criada com sucesso!')
    },
    onError: () => toast.error('Erro ao criar recorrência.'),
  })
}

// ─────────────────────────────────────────────────────────────
// ATUALIZAR REGRA DE RECORRÊNCIA (incl. pausar/retomar)
// ─────────────────────────────────────────────────────────────
export function useUpdateRecurrence() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      frequency,
      dayOfWeek,
      dayOfMonth,
      timeOfDay,
      assignedTo,
      titlePrefix,
      description,
      isActive,
    }: {
      id: string
      frequency?: ChecklistRecurrence['frequency']
      dayOfWeek?: number[] | null
      dayOfMonth?: number | null
      timeOfDay?: string
      assignedTo?: string | null
      titlePrefix?: string | null
      description?: string | null
      isActive?: boolean
    }) => {
      const supabase = createClient()
      const patch: Record<string, unknown> = {}

      if (frequency !== undefined)    patch.frequency = frequency
      if (dayOfWeek !== undefined)    patch.day_of_week = dayOfWeek
      if (dayOfMonth !== undefined)   patch.day_of_month = dayOfMonth
      if (timeOfDay !== undefined)    patch.time_of_day = timeOfDay + ':00'
      if (assignedTo !== undefined)   patch.assigned_to = assignedTo
      if (titlePrefix !== undefined)  patch.title_prefix = titlePrefix
      if (description !== undefined)  patch.description = description

      if (isActive !== undefined) {
        patch.is_active = isActive
        // Recalcular próxima geração ao reativar
        if (isActive) {
          // Se frequency foi passado, usa; senão, busca do banco
          const effectiveFrequency = frequency ?? (await (async () => {
            const { data } = await supabase
              .from('checklist_recurrence')
              .select('frequency, day_of_week, day_of_month, time_of_day')
              .eq('id', id)
              .single()
            return data
          })())

          if (effectiveFrequency) {
            const freq = frequency ?? (effectiveFrequency as { frequency: import('@/types/database.types').ChecklistRecurrence['frequency'] }).frequency
            const dow  = dayOfWeek  !== undefined ? dayOfWeek  : (effectiveFrequency as { day_of_week?: number[] | null }).day_of_week ?? undefined
            const dom  = dayOfMonth !== undefined ? dayOfMonth : (effectiveFrequency as { day_of_month?: number | null }).day_of_month ?? undefined
            const tod  = timeOfDay  !== undefined ? timeOfDay  : ((effectiveFrequency as { time_of_day?: string }).time_of_day ?? '08:00').substring(0, 5)
            patch.next_generation_at = calcNextGenerationAt(freq, dow, dom, tod)
          }
        }
      }

      const { error } = await supabase
        .from('checklist_recurrence')
        .update(patch)
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: (_, { isActive }) => {
      qc.invalidateQueries({ queryKey: ['checklist-recurrences'] })
      if (isActive === false) toast.success('Recorrência pausada.')
      else if (isActive === true) toast.success('Recorrência retomada.')
      else toast.success('Recorrência atualizada.')
    },
    onError: () => toast.error('Erro ao atualizar recorrência.'),
  })
}

// ─────────────────────────────────────────────────────────────
// DELETAR REGRA DE RECORRÊNCIA
// ─────────────────────────────────────────────────────────────
export function useDeleteRecurrence() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('checklist_recurrence')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['checklist-recurrences'] })
      toast.success('Recorrência excluída.')
    },
    onError: () => toast.error('Erro ao excluir recorrência.'),
  })
}
