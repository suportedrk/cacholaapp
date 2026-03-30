'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'
import {
  notifyProviderAddedToEvent,
  notifyProviderStatusChanged,
} from '@/lib/notifications'
import type {
  EventProvider,
  CreateEventProviderInput,
  UpdateEventProviderInput,
} from '@/types/providers'

const EVENT_PROVIDER_SELECT = `
  *,
  provider:service_providers(*),
  category:service_categories(*)
` as const

const EVENT_PROVIDER_WITH_EVENT_SELECT = `
  *,
  provider:service_providers(*),
  category:service_categories(*),
  event:events(id, title, date, start_time, end_time)
` as const

// ─────────────────────────────────────────────────────────────
// useEventProviders — Prestadores de um evento
// ─────────────────────────────────────────────────────────────
export function useEventProviders(eventId: string | null) {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['event-providers', eventId, activeUnitId],
    enabled: !!eventId && !!activeUnitId && isSessionReady,
    staleTime: 30 * 1000,
    retry: (count, error: unknown) => {
      const status = (error as { status?: number; code?: number })?.status
        ?? (error as { status?: number; code?: number })?.code
      if (status === 401 || status === 403) return false
      return count < 2
    },
    queryFn: async (): Promise<EventProvider[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('event_providers')
        .select(EVENT_PROVIDER_SELECT)
        .eq('event_id', eventId!)
        .eq('unit_id', activeUnitId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as unknown as EventProvider[]
    },
  })
}

// ─────────────────────────────────────────────────────────────
// useProviderEvents — Histórico de festas de um prestador
// ─────────────────────────────────────────────────────────────
export function useProviderEvents(providerId: string | null) {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['provider-events', providerId, activeUnitId],
    enabled: !!providerId && !!activeUnitId && isSessionReady,
    staleTime: 60 * 1000,
    retry: (count, error: unknown) => {
      const status = (error as { status?: number; code?: number })?.status
        ?? (error as { status?: number; code?: number })?.code
      if (status === 401 || status === 403) return false
      return count < 2
    },
    queryFn: async (): Promise<EventProvider[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('event_providers')
        .select(EVENT_PROVIDER_WITH_EVENT_SELECT)
        .eq('provider_id', providerId!)
        .eq('unit_id', activeUnitId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as unknown as EventProvider[]
    },
  })
}

// ─────────────────────────────────────────────────────────────
// useProviderScheduleConflicts — Verificar conflitos de agenda
// ─────────────────────────────────────────────────────────────
export function useProviderScheduleConflicts(
  providerId: string | null,
  eventDate: string | null,         // 'YYYY-MM-DD'
  excludeEventId?: string | null    // current event to exclude from check
) {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['provider-conflicts', providerId, eventDate, excludeEventId, activeUnitId],
    enabled: !!providerId && !!eventDate && !!activeUnitId && isSessionReady,
    staleTime: 30 * 1000, // needs to be fresh
    retry: false,
    queryFn: async (): Promise<EventProvider[]> => {
      const supabase = createClient()
      let query = supabase
        .from('event_providers')
        .select(EVENT_PROVIDER_WITH_EVENT_SELECT)
        .eq('provider_id', providerId!)
        .in('status', ['pending', 'confirmed'])

      // Filter by event date via join
      // Supabase PostgREST supports filtering on joined columns
      const { data, error } = await query
      if (error) throw error

      // Apply date filter client-side (joined field)
      let conflicts = (data as unknown as EventProvider[]).filter(
        (ep) => ep.event?.date === eventDate
      )

      // Exclude current event if editing
      if (excludeEventId) {
        conflicts = conflicts.filter((ep) => ep.event_id !== excludeEventId)
      }

      return conflicts
    },
  })
}

// ─────────────────────────────────────────────────────────────
// useAddProviderToEvent
// ─────────────────────────────────────────────────────────────
export function useAddProviderToEvent() {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async (input: CreateEventProviderInput) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('event_providers')
        .insert({ ...input, created_by: user?.id ?? null })
        .select(EVENT_PROVIDER_SELECT)
        .single()
      if (error) throw error
      return data as unknown as EventProvider
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['event-providers', data.event_id, activeUnitId] })
      qc.invalidateQueries({ queryKey: ['provider-events', data.provider_id, activeUnitId] })
      qc.invalidateQueries({ queryKey: ['provider', data.provider_id, activeUnitId] })
      qc.invalidateQueries({ queryKey: ['providers', activeUnitId] })
      toast.success('Prestador adicionado ao evento.')
      ;(async () => {
        try {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          await notifyProviderAddedToEvent(supabase, data.id, user?.id ?? undefined)
        } catch { /* non-critical */ }
      })()
    },
    onError: (error: unknown) => {
      const msg = (error as { message?: string })?.message ?? ''
      if (msg.includes('unique') || msg.includes('duplicate')) {
        toast.error('Este prestador já está associado a este evento.')
      } else {
        toast.error('Erro ao adicionar prestador ao evento.')
      }
    },
  })
}

// ─────────────────────────────────────────────────────────────
// useUpdateEventProvider — Status, preço, horário
// ─────────────────────────────────────────────────────────────
export function useUpdateEventProvider() {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async ({ id, event_id, provider_id, ...patch }: UpdateEventProviderInput) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const update: Record<string, unknown> = { ...patch }

      // Set confirmed_by/at when confirming
      if (patch.status === 'confirmed') {
        update.confirmed_by = user?.id ?? null
        update.confirmed_at = new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('event_providers')
        .update(update)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return { ...data, event_id, provider_id }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['event-providers', data.event_id, activeUnitId] })
      qc.invalidateQueries({ queryKey: ['provider-events', data.provider_id, activeUnitId] })
      toast.success('Prestador atualizado.')
      if (data.status) {
        ;(async () => {
          try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            await notifyProviderStatusChanged(supabase, data.id, data.status as string, user?.id ?? undefined)
          } catch { /* non-critical */ }
        })()
      }
    },
    onError: () => toast.error('Erro ao atualizar prestador do evento.'),
  })
}

// ─────────────────────────────────────────────────────────────
// useRemoveProviderFromEvent
// ─────────────────────────────────────────────────────────────
export function useRemoveProviderFromEvent() {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async ({
      id,
      event_id,
      provider_id,
    }: { id: string; event_id: string; provider_id: string }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('event_providers')
        .delete()
        .eq('id', id)
      if (error) throw error
      return { id, event_id, provider_id }
    },
    onSuccess: ({ event_id, provider_id }) => {
      qc.invalidateQueries({ queryKey: ['event-providers', event_id, activeUnitId] })
      qc.invalidateQueries({ queryKey: ['provider-events', provider_id, activeUnitId] })
      qc.invalidateQueries({ queryKey: ['provider', provider_id, activeUnitId] })
      qc.invalidateQueries({ queryKey: ['providers', activeUnitId] })
      toast.success('Prestador removido do evento.')
    },
    onError: () => toast.error('Erro ao remover prestador do evento.'),
  })
}
