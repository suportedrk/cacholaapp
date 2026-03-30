'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'
import type {
  ServiceProviderListItem,
  ServiceProviderWithDetails,
  ProviderFilters,
  CreateProviderInput,
  UpdateProviderInput,
} from '@/types/providers'

// ─────────────────────────────────────────────────────────────
// SELECT strings
// ─────────────────────────────────────────────────────────────
const PROVIDER_LIST_SELECT = `
  *,
  contacts:provider_contacts(*),
  services:provider_services(*, category:service_categories(*)),
  docs:provider_documents(id,expires_at),
  upcoming_events_agg:event_providers(count)
` as const

const PROVIDER_DETAIL_SELECT = `
  *,
  contacts:provider_contacts(*),
  services:provider_services(*, category:service_categories(*)),
  documents:provider_documents(*),
  ratings:provider_ratings(*, event:events(id, title, date), rated_by_user:users!provider_ratings_rated_by_fkey(id, name)),
  event_providers(*, event:events(id, title, date, start_time, end_time), category:service_categories(*))
` as const

// ─────────────────────────────────────────────────────────────
// useProviders — Lista com filtros (categoria client-side)
// ─────────────────────────────────────────────────────────────
export function useProviders(filters?: Partial<ProviderFilters>) {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  // Serialise filters for queryKey stability
  const filtersKey = JSON.stringify(filters ?? {})

  return useQuery({
    queryKey: ['providers', activeUnitId, filtersKey],
    enabled: !!activeUnitId && isSessionReady,
    staleTime: 30 * 1000,
    retry: (count, error: unknown) => {
      const status = (error as { status?: number; code?: number })?.status
        ?? (error as { status?: number; code?: number })?.code
      if (status === 401 || status === 403) return false
      return count < 2
    },
    queryFn: async () => {
      const supabase = createClient()

      let query = supabase
        .from('service_providers')
        .select(PROVIDER_LIST_SELECT)
        .eq('unit_id', activeUnitId!)
        .order('name', { ascending: true })

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }

      if (filters?.search) {
        query = query.or(
          `name.ilike.%${filters.search}%,document_number.ilike.%${filters.search}%`
        )
      }

      if (filters?.min_rating && filters.min_rating > 0) {
        query = query.gte('avg_rating', filters.min_rating)
      }

      const { data, error } = await query
      if (error) throw error

      // Shape the aggregated counts and apply client-side category filter
      const now = new Date()
      const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

      let items = (data ?? []).map((row) => {
        const r = row as Record<string, unknown>
        const docs = (r.docs as { id: string; expires_at: string | null }[]) ?? []
        const evAgg = r.upcoming_events_agg as { count: number }[] | null
        return {
          ...r,
          documents_count: docs.length,
          expiring_docs: docs,
          upcoming_events_count: evAgg?.[0]?.count ?? 0,
        } as ServiceProviderListItem
      })

      // Category filter: client-side — keep providers that offer the selected category
      if (filters?.category_id && filters.category_id !== 'all') {
        items = items.filter((p) =>
          (p.services ?? []).some(
            (s) => s.category_id === filters.category_id
          )
        )
      }

      // has_expiring_docs filter: client-side — docs expiring within 30 days
      if (filters?.has_expiring_docs) {
        items = items.filter((p) =>
          (p.expiring_docs ?? []).some((d) => {
            if (!d.expires_at) return false
            const exp = new Date(d.expires_at)
            return exp <= thirtyDaysLater
          })
        )
      }

      return items
    },
  })
}

// ─────────────────────────────────────────────────────────────
// useProvider — Detalhe completo
// ─────────────────────────────────────────────────────────────
export function useProvider(providerId: string | null) {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['provider', providerId, activeUnitId],
    enabled: !!providerId && !!activeUnitId && isSessionReady,
    staleTime: 30 * 1000,
    retry: (count, error: unknown) => {
      const status = (error as { status?: number; code?: number })?.status
        ?? (error as { status?: number; code?: number })?.code
      if (status === 401 || status === 403) return false
      return count < 2
    },
    queryFn: async (): Promise<ServiceProviderWithDetails> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('service_providers')
        .select(PROVIDER_DETAIL_SELECT)
        .eq('id', providerId!)
        .eq('unit_id', activeUnitId!)
        .single()
      if (error) throw error
      return data as unknown as ServiceProviderWithDetails
    },
  })
}

// ─────────────────────────────────────────────────────────────
// useCreateProvider
// ─────────────────────────────────────────────────────────────
export function useCreateProvider() {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async (input: CreateProviderInput) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('service_providers')
        .insert({
          ...input,
          unit_id:    activeUnitId!,
          created_by: user?.id ?? null,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['providers', activeUnitId] })
      toast.success('Prestador cadastrado com sucesso.')
    },
    onError: (error: unknown) => {
      const msg = (error as { message?: string })?.message ?? ''
      if (msg.includes('unique') || msg.includes('duplicate')) {
        toast.error('Já existe um prestador com este documento nesta unidade.')
      } else {
        toast.error('Erro ao cadastrar prestador.')
      }
    },
  })
}

// ─────────────────────────────────────────────────────────────
// useUpdateProvider
// ─────────────────────────────────────────────────────────────
export function useUpdateProvider() {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async ({ id, ...patch }: UpdateProviderInput) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('service_providers')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['providers', activeUnitId] })
      qc.invalidateQueries({ queryKey: ['provider', data.id, activeUnitId] })
      toast.success('Prestador atualizado.')
    },
    onError: () => toast.error('Erro ao atualizar prestador.'),
  })
}

// ─────────────────────────────────────────────────────────────
// useDeleteProvider
// ─────────────────────────────────────────────────────────────
export function useDeleteProvider() {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('service_providers')
        .delete()
        .eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['providers', activeUnitId] })
      toast.success('Prestador removido com sucesso.')
    },
    onError: () => toast.error('Erro ao remover prestador.'),
  })
}

// ─────────────────────────────────────────────────────────────
// useProviderEvents — Histórico de eventos de um prestador
// ─────────────────────────────────────────────────────────────
const PROVIDER_EVENT_SELECT = `
  *,
  event:events(id, title, date, start_time, end_time, status),
  category:service_categories(id, name, icon, color)
` as const

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
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('event_providers')
        .select(PROVIDER_EVENT_SELECT)
        .eq('provider_id', providerId!)
        .eq('unit_id', activeUnitId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as ProviderEventItem[]
    },
  })
}

export type ProviderEventItem = import('@/types/providers').EventProvider & {
  event: { id: string; title?: string | null; date?: string | null; start_time?: string | null; end_time?: string | null; status?: string | null } | null
  category: import('@/types/providers').ServiceCategory | null
}
