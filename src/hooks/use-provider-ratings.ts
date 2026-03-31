'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'
import type { ProviderRating, CreateRatingInput, UpdateRatingInput } from '@/types/providers'

const RATING_SELECT = `
  *,
  event:events(id, title, date),
  rated_by_user:users!provider_ratings_rated_by_fkey(id, name)
` as const

// ─────────────────────────────────────────────────────────────
// useProviderRatings — Avaliações de um prestador
// ─────────────────────────────────────────────────────────────
export function useProviderRatings(providerId: string | null) {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['provider-ratings', providerId, activeUnitId],
    enabled: !!providerId && isSessionReady,
    staleTime: 60 * 1000,
    retry: (count, error: unknown) => {
      const status = (error as { status?: number; code?: number })?.status
        ?? (error as { status?: number; code?: number })?.code
      if (status === 401 || status === 403) return false
      return count < 2
    },
    queryFn: async (): Promise<ProviderRating[]> => {
      const supabase = createClient()
      let rQuery = supabase
        .from('provider_ratings')
        .select(RATING_SELECT)
        .eq('provider_id', providerId!)
        .order('created_at', { ascending: false })
      if (activeUnitId) rQuery = rQuery.eq('unit_id', activeUnitId)
      const { data, error } = await rQuery
      if (error) throw error
      return data as unknown as ProviderRating[]
    },
  })
}

// ─────────────────────────────────────────────────────────────
// usePendingRatings — Eventos concluídos sem avaliação
// ─────────────────────────────────────────────────────────────
export function usePendingRatings() {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['pending-ratings', activeUnitId],
    enabled: isSessionReady,
    staleTime: 2 * 60 * 1000,
    retry: (count, error: unknown) => {
      const status = (error as { status?: number; code?: number })?.status
        ?? (error as { status?: number; code?: number })?.code
      if (status === 401 || status === 403) return false
      return count < 2
    },
    queryFn: async () => {
      const supabase = createClient()

      // Get completed event_providers without a rating
      let pendingQuery = supabase
        .from('event_providers')
        .select(`
          *,
          provider:service_providers(id, name, avg_rating),
          event:events(id, title, date),
          category:service_categories(id, name, icon, color)
        `)
        .eq('status', 'completed')
      if (activeUnitId) pendingQuery = pendingQuery.eq('unit_id', activeUnitId)
      const { data: completed, error } = await pendingQuery

      if (error) throw error

      if (!completed || completed.length === 0) return []

      // Get all ratings for the completed event_providers
      const ids = completed.map((ep) => ep.id)
      const { data: ratings } = await supabase
        .from('provider_ratings')
        .select('event_provider_id')
        .in('event_provider_id', ids)

      const ratedIds = new Set((ratings ?? []).map((r) => r.event_provider_id))

      return completed.filter((ep) => !ratedIds.has(ep.id))
    },
  })
}

// ─────────────────────────────────────────────────────────────
// useCreateRating
// ─────────────────────────────────────────────────────────────
export function useCreateRating() {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async (input: CreateRatingInput) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('provider_ratings')
        .insert({ ...input, rated_by: user!.id })
        .select(RATING_SELECT)
        .single()
      if (error) throw error
      return data as unknown as ProviderRating
    },
    onSuccess: (data) => {
      // DB trigger recalcula avg_rating em service_providers automaticamente
      qc.invalidateQueries({ queryKey: ['provider-ratings', data.provider_id, activeUnitId] })
      qc.invalidateQueries({ queryKey: ['event-ratings', data.event_id, activeUnitId] })
      qc.invalidateQueries({ queryKey: ['provider', data.provider_id, activeUnitId] })
      qc.invalidateQueries({ queryKey: ['providers', activeUnitId] })
      qc.invalidateQueries({ queryKey: ['pending-ratings', activeUnitId] })
      qc.invalidateQueries({ queryKey: ['provider-kpis', activeUnitId] })
      toast.success('Avaliação registrada com sucesso.')
    },
    onError: (error: unknown) => {
      const msg = (error as { message?: string })?.message ?? ''
      if (msg.includes('unique') || msg.includes('duplicate')) {
        toast.error('Este prestador já foi avaliado para este evento.')
      } else {
        toast.error('Erro ao registrar avaliação.')
      }
    },
  })
}

// ─────────────────────────────────────────────────────────────
// useUpdateRating
// ─────────────────────────────────────────────────────────────
export function useUpdateRating() {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async ({ id, provider_id, ...patch }: UpdateRatingInput) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('provider_ratings')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return { ...data, provider_id }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['provider-ratings', data.provider_id, activeUnitId] })
      qc.invalidateQueries({ queryKey: ['provider', data.provider_id, activeUnitId] })
      qc.invalidateQueries({ queryKey: ['providers', activeUnitId] })
      toast.success('Avaliação atualizada.')
    },
    onError: () => toast.error('Erro ao atualizar avaliação.'),
  })
}

// ─────────────────────────────────────────────────────────────
// useEventRatings — Avaliações de todos os prestadores de um evento
// Retorna um mapa: event_provider_id → ProviderRating
// ─────────────────────────────────────────────────────────────
export function useEventRatings(eventId: string | null) {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['event-ratings', eventId, activeUnitId],
    enabled: !!eventId && !!activeUnitId && isSessionReady,
    staleTime: 30 * 1000,
    retry: (count, error: unknown) => {
      const status = (error as { status?: number; code?: number })?.status
        ?? (error as { status?: number; code?: number })?.code
      if (status === 401 || status === 403) return false
      return count < 2
    },
    queryFn: async (): Promise<Record<string, ProviderRating>> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('provider_ratings')
        .select(RATING_SELECT)
        .eq('event_id', eventId!)
        .eq('unit_id', activeUnitId!)
      if (error) throw error
      const map: Record<string, ProviderRating> = {}
      for (const r of (data ?? []) as unknown as ProviderRating[]) {
        map[r.event_provider_id] = r
      }
      return map
    },
  })
}
