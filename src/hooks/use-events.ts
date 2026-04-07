'use client'

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type { EventWithDetails, EventForList, EventInsert, EventUpdate, EventStatus } from '@/types/database.types'
import { toast } from 'sonner'
import { notifyEventCreated, notifyStatusChanged } from '@/lib/notifications'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'

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

const EVENT_FOR_LIST_SELECT = `
  *,
  event_type:event_types(id, name),
  package:packages(id, name),
  venue:venues(id, name, capacity),
  staff:event_staff(
    id,
    role_in_event,
    user:users(id, name, avatar_url)
  ),
  checklists(id, status, checklist_items(id, status)),
  providers_count:event_providers(count)
` as const

const EVENTS_PAGE_SIZE = 20

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
// ABAS TEMPORAIS
// ─────────────────────────────────────────────────────────────
export type TabKey = 'today' | 'week' | 'month' | 'all'

export function getTabDateRange(tab: TabKey, now: Date): { start: string; end: string } | null {
  if (tab === 'all') return null
  if (tab === 'today') {
    const d = format(now, 'yyyy-MM-dd')
    return { start: d, end: d }
  }
  if (tab === 'week') {
    return {
      start: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      end:   format(endOfWeek(now,   { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    }
  }
  // month
  return {
    start: format(startOfMonth(now), 'yyyy-MM-dd'),
    end:   format(endOfMonth(now),   'yyyy-MM-dd'),
  }
}

// ─────────────────────────────────────────────────────────────
// CONTADORES POR ABA
// ─────────────────────────────────────────────────────────────
export function useEventsTabCounts() {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['events-tab-counts', activeUnitId],
    enabled: isSessionReady,
    staleTime: 2 * 60 * 1000,
    retry: (failureCount, error: unknown) => {
      const status = (error as { status?: number })?.status
      if (status === 401 || status === 403) return false
      return failureCount < 3
    },
    queryFn: async () => {
      // Uma única query retorna todos os eventos (id + date).
      // Contagem feita client-side para evitar 4 aquisições simultâneas do
      // lock de auth do Supabase (navigator.locks.request, modo exclusivo).
      const supabase = createClient()
      const now = new Date()

      let q = supabase
        .from('events')
        .select('date')
        .neq('status', 'lost')
        .limit(5000)
      if (activeUnitId) q = q.eq('unit_id', activeUnitId)

      const { data } = await q
      const dates = (data ?? []).map((r: { date: string }) => r.date)

      const todayStr  = format(now, 'yyyy-MM-dd')
      const weekRange = getTabDateRange('week', now)!
      const monRange  = getTabDateRange('month', now)!

      return {
        all:   dates.length,
        today: dates.filter((d) => d === todayStr).length,
        week:  dates.filter((d) => d >= weekRange.start && d <= weekRange.end).length,
        month: dates.filter((d) => d >= monRange.start  && d <= monRange.end).length,
      } as Record<TabKey, number>
    },
  })
}

// ─────────────────────────────────────────────────────────────
// BUSCA POR IDs ESPECÍFICOS (filtros de conflito)
// Busca todos os eventos cujos IDs estão no array fornecido,
// sem paginação — usado pelos filtros de sobreposição/intervalo.
// ─────────────────────────────────────────────────────────────
export function useEventsByIds(ids: string[]) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery<EventForList[]>({
    queryKey: ['events-by-ids', ids],
    enabled:  isSessionReady && ids.length > 0,
    staleTime: 30 * 1000,
    retry: (count, error: unknown) => {
      const st = (error as { status?: number })?.status
      if (st === 401 || st === 403) return false
      return count < 2
    },
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('events')
        .select(EVENT_FOR_LIST_SELECT)
        .in('id', ids)
        .order('date',       { ascending: true })
        .order('start_time', { ascending: true })
      if (error) throw error
      // Supabase infere SelectQueryError nas relações — cast via unknown necessário
      return (data ?? []) as unknown as EventForList[]
    },
  })
}

// ─────────────────────────────────────────────────────────────
// LISTAGEM INFINITA (página principal de eventos)
// ─────────────────────────────────────────────────────────────
export type EventFiltersInfinite = {
  tab: TabKey
  status?: EventStatus[]
  search?: string
  noDateFilter?: boolean  // desativa o filtro date >= hoje (usado por filtros de conflito)
}

export function useEventsInfinite(filters: EventFiltersInfinite) {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const { tab, status, search, noDateFilter } = filters

  return useInfiniteQuery({
    queryKey: ['events-infinite', activeUnitId, tab, status, search, noDateFilter],
    enabled: isSessionReady,
    staleTime: 30 * 1000,
    initialPageParam: 0 as number,
    retry: (failureCount, error: unknown) => {
      const st = (error as { status?: number })?.status
      if (st === 401 || st === 403) return false
      return failureCount < 3
    },
    getNextPageParam: (lastPage: { events: EventForList[]; total: number; offset: number }) => {
      const next = lastPage.offset + EVENTS_PAGE_SIZE
      return next < lastPage.total ? next : undefined
    },
    queryFn: async ({ pageParam }) => {
      const supabase = createClient()
      const offset = pageParam as number
      const now    = new Date()

      let query = supabase
        .from('events')
        .select(EVENT_FOR_LIST_SELECT, { count: 'exact' })
        .order('date',       { ascending: true })
        .order('start_time', { ascending: true })
        .range(offset, offset + EVENTS_PAGE_SIZE - 1)

      if (activeUnitId) query = query.eq('unit_id', activeUnitId)

      const dateRange = getTabDateRange(tab, now)
      if (dateRange) {
        query = query.gte('date', dateRange.start).lte('date', dateRange.end)
      } else if (!noDateFilter && !search?.trim() && !status?.length) {
        // Aba "Todos" sem filtros: exibe apenas eventos a partir de hoje
        // (noDateFilter=true desativa isso para filtros de conflito)
        query = query.gte('date', format(now, 'yyyy-MM-dd'))
      }

      if (status?.length) {
        query = query.in('status', status)
      } else {
        query = query.neq('status', 'lost')
      }

      if (search?.trim()) {
        query = query.or(
          `client_name.ilike.%${search}%,birthday_person.ilike.%${search}%,title.ilike.%${search}%`
        )
      }

      const { data, error, count } = await query
      if (error) throw error

      return {
        events: (data ?? []) as unknown as EventForList[],
        total:  count ?? 0,
        offset,
      }
    },
  })
}

// ─────────────────────────────────────────────────────────────
// KPIs DA PÁGINA DE EVENTOS (checklist % + pendentes sem checklist)
// ─────────────────────────────────────────────────────────────
export function useEventsKpis() {
  const { activeUnitId } = useUnitStore()
  const isSessionReady   = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['events-kpis', activeUnitId],
    enabled:  isSessionReady,
    staleTime: 2 * 60 * 1000,
    retry: (failureCount, error: unknown) => {
      const st = (error as { status?: number })?.status
      if (st === 401 || st === 403) return false
      return failureCount < 3
    },
    queryFn: async () => {
      const supabase = createClient()
      const now      = new Date()
      const weekRange = getTabDateRange('week', now)!
      // Próximos 7 dias para "pendentes sem checklist"
      const todayStr  = format(now, 'yyyy-MM-dd')
      const in7days   = format(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')

      // 1) Eventos da semana com checklists (para calcular % médio)
      let weekQuery = supabase
        .from('events')
        .select('id, checklists(id, status, checklist_items(id, status))')
        .gte('date', weekRange.start)
        .lte('date', weekRange.end)
        .neq('status', 'lost')
      if (activeUnitId) weekQuery = weekQuery.eq('unit_id', activeUnitId)

      // 2) Eventos próximos 7 dias sem nenhum checklist
      let pendingQuery = supabase
        .from('events')
        .select('id, checklists(id)')
        .gte('date', todayStr)
        .lte('date', in7days)
        .neq('status', 'lost')
      if (activeUnitId) pendingQuery = pendingQuery.eq('unit_id', activeUnitId)

      const [{ data: weekEvents }, { data: upcomingEvents }] = await Promise.all([
        weekQuery,
        pendingQuery,
      ])

      // Calcular % médio de checklists da semana
      let checklistPct = 0
      if (weekEvents && weekEvents.length > 0) {
        const progresses = weekEvents.map((ev) => {
          const raw = ev as unknown as { checklists?: Array<{ checklist_items?: Array<{ status: string }> }> }
          const items = raw.checklists?.flatMap((c) => c.checklist_items ?? []) ?? []
          if (items.length === 0) return null
          const done = items.filter((i) => i.status === 'done').length
          return Math.round((done / items.length) * 100)
        }).filter((p): p is number => p !== null)
        checklistPct = progresses.length > 0
          ? Math.round(progresses.reduce((a, b) => a + b, 0) / progresses.length)
          : 0
      }

      // Contar eventos futuros sem nenhum checklist
      const pendingCount = (upcomingEvents ?? []).filter((ev) => {
        const raw = ev as unknown as { checklists?: Array<{ id: string }> }
        return !raw.checklists || raw.checklists.length === 0
      }).length

      return { checklistPct, pendingCount }
    },
  })
}

// ─────────────────────────────────────────────────────────────
// LISTAR EVENTOS
// ─────────────────────────────────────────────────────────────
export function useEvents(filters: EventFilters = {}) {
  const { search, status, dateFrom, dateTo, page = 1, pageSize = 12 } = filters
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['events', filters, activeUnitId],
    enabled: isSessionReady,
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
      // Por padrão (sem filtro), 'lost' é excluído — o usuário precisa selecionar explicitamente
      if (status?.length) {
        query = query.in('status', status)
      } else {
        query = query.neq('status', 'lost')
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
