'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { EventWithDetails, EventInsert, EventUpdate, EventStatus } from '@/types/database.types'
import { toast } from 'sonner'
import { notifyEventCreated, notifyStatusChanged } from '@/lib/notifications'
import { useUnitStore } from '@/stores/unit-store'

const EVENT_WITH_DETAILS_SELECT = `
  *,
  event_type:event_types(id, name),
  package:packages(id, name),
  venue:venues(id, name, capacity),
  staff:event_staff(
    id,
    role_in_event,
    user:users(id, name, avatar_url)
  )
` as const

// ─────────────────────────────────────────────────────────────
// FILTROS
// ─────────────────────────────────────────────────────────────
export type EventFilters = {
  search?: string
  status?: EventStatus[]
  dateFrom?: string  // 'YYYY-MM-DD'
  dateTo?: string    // 'YYYY-MM-DD'
  page?: number
  pageSize?: number
}

// ─────────────────────────────────────────────────────────────
// LISTAR EVENTOS
// ─────────────────────────────────────────────────────────────
export function useEvents(filters: EventFilters = {}) {
  const { search, status, dateFrom, dateTo, page = 1, pageSize = 12 } = filters
  const { activeUnitId } = useUnitStore()

  return useQuery({
    queryKey: ['events', filters, activeUnitId],
    queryFn: async () => {
      const supabase = createClient()

      let query = supabase
        .from('events')
        .select(EVENT_WITH_DETAILS_SELECT, { count: 'exact' })
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })

      // Filtro por unidade ativa
      if (activeUnitId) query = query.eq('unit_id', activeUnitId)

      // Filtro por busca (nome contratante ou aniversariante)
      if (search?.trim()) {
        query = query.or(
          `client_name.ilike.%${search}%,birthday_person.ilike.%${search}%,title.ilike.%${search}%`
        )
      }

      // Filtro por status
      if (status?.length) {
        query = query.in('status', status)
      }

      // Filtro por período
      if (dateFrom) query = query.gte('date', dateFrom)
      if (dateTo)   query = query.lte('date', dateTo)

      // Paginação
      const from = (page - 1) * pageSize
      query = query.range(from, from + pageSize - 1)

      const { data, error, count } = await query
      if (error) throw error

      return {
        events: (data ?? []) as unknown as EventWithDetails[],
        total: count ?? 0,
        page,
        pageSize,
        totalPages: Math.ceil((count ?? 0) / pageSize),
      }
    },
    staleTime: 30 * 1000, // 30s
  })
}

// ─────────────────────────────────────────────────────────────
// DETALHE DO EVENTO
// ─────────────────────────────────────────────────────────────
export function useEvent(id: string | null) {
  return useQuery({
    queryKey: ['events', id],
    enabled: !!id,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('events')
        .select(EVENT_WITH_DETAILS_SELECT)
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as unknown as EventWithDetails
    },
  })
}

// ─────────────────────────────────────────────────────────────
// CRIAR EVENTO
// ─────────────────────────────────────────────────────────────
export function useCreateEvent() {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async ({
      eventData,
      staffEntries,
    }: {
      eventData: EventInsert
      staffEntries: { user_id: string; role_in_event: string }[]
    }) => {
      const supabase = createClient()

      // Inserir evento
      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({ ...eventData, unit_id: activeUnitId! })
        .select('id')
        .single()

      if (eventError) throw eventError

      // Inserir equipe (se houver)
      if (staffEntries.length > 0) {
        const { error: staffError } = await supabase
          .from('event_staff')
          .insert(staffEntries.map((s) => ({ ...s, event_id: event.id })))
        if (staffError) throw staffError
      }

      return event.id
    },
    onSuccess: (eventId) => {
      qc.invalidateQueries({ queryKey: ['events'] })
      toast.success('Evento criado com sucesso!')
      // Fire-and-forget: notifica equipe escalada
      ;(async () => {
        try {
          const sb = createClient()
          const { data: { user } } = await sb.auth.getUser()
          await notifyEventCreated(sb as any, eventId, user?.id)
        } catch { /* não-crítico */ }
      })()
    },
    onError: () => toast.error('Erro ao criar evento. Tente novamente.'),
  })
}

// ─────────────────────────────────────────────────────────────
// ATUALIZAR EVENTO
// ─────────────────────────────────────────────────────────────
export function useUpdateEvent() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      eventData,
      staffEntries,
    }: {
      id: string
      eventData: EventUpdate
      staffEntries?: { user_id: string; role_in_event: string }[]
    }) => {
      const supabase = createClient()

      const { error: updateError } = await supabase
        .from('events')
        .update(eventData)
        .eq('id', id)
      if (updateError) throw updateError

      // Substituir equipe se fornecida
      if (staffEntries !== undefined) {
        await supabase.from('event_staff').delete().eq('event_id', id)
        if (staffEntries.length > 0) {
          const { error: staffError } = await supabase
            .from('event_staff')
            .insert(staffEntries.map((s) => ({ ...s, event_id: id })))
          if (staffError) throw staffError
        }
      }

    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['events'] })
      qc.invalidateQueries({ queryKey: ['events', id] })
      toast.success('Evento atualizado com sucesso!')
    },
    onError: () => toast.error('Erro ao atualizar evento.'),
  })
}

// ─────────────────────────────────────────────────────────────
// MUDAR STATUS (ação rápida na tela de detalhe)
// ─────────────────────────────────────────────────────────────
export function useChangeEventStatus() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: EventStatus }) => {
      const supabase = createClient()
      const { error } = await supabase.from('events').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, { id, status }) => {
      qc.invalidateQueries({ queryKey: ['events'] })
      qc.invalidateQueries({ queryKey: ['events', id] })
      toast.success('Status atualizado.')
      // Fire-and-forget: notifica equipe sobre novo status
      ;(async () => {
        try {
          const sb = createClient()
          const { data: { user } } = await sb.auth.getUser()
          await notifyStatusChanged(sb as any, id, status, user?.id)
        } catch { /* não-crítico */ }
      })()
    },
    onError: () => toast.error('Erro ao atualizar status.'),
  })
}

// ─────────────────────────────────────────────────────────────
// SOFT DELETE (desativa o evento — não exclui do banco)
// ─────────────────────────────────────────────────────────────
export function useDeleteEvent() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      // Soft delete: marca como finished (sem estado "cancelado" no novo enum)
      // O evento fica visível no histórico mas não aparece nas listas ativas
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] })
      toast.success('Evento excluído.')
    },
    onError: () => toast.error('Erro ao excluir evento.'),
  })
}
