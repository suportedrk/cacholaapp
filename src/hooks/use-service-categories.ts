'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'
import type { ServiceCategory } from '@/types/providers'
import { mapPgError } from '@/lib/errors/map-pg-error'

// ─────────────────────────────────────────────────────────────
// useServiceCategories — Lista categorias ativas da unidade
// ─────────────────────────────────────────────────────────────
export function useServiceCategories(includeInactive = false) {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['service-categories', activeUnitId, includeInactive],
    enabled: isSessionReady,
    staleTime: 5 * 60 * 1000,
    retry: (count, error: unknown) => {
      const status = (error as { status?: number; code?: number })?.status
        ?? (error as { status?: number; code?: number })?.code
      if (status === 401 || status === 403) return false
      return count < 2
    },
    queryFn: async (): Promise<ServiceCategory[]> => {
      const supabase = createClient()
      let query = supabase
        .from('service_categories')
        .select('*')
        .order('sort_order', { ascending: true })
      if (activeUnitId) query = query.eq('unit_id', activeUnitId)

      if (!includeInactive) {
        query = query.eq('is_active', true)
      }

      const { data, error } = await query
      if (error) throw error
      return data as ServiceCategory[]
    },
  })
}

// ─────────────────────────────────────────────────────────────
// useCreateCategory
// ─────────────────────────────────────────────────────────────
// Payload exige `unit_id` explícito — caller decide a unidade (Fase 4b).
// NOTA: este hook não é consumido por nenhum form ativo do cliente; service_categories
// só é populado via API server-side (`/api/units/copy-templates`). Mantido como hook
// seguro para uso futuro, caso uma UI de criação seja adicionada.
export type ServiceCategoryCreatePayload = {
  name: string
  slug: string
  description?: string
  icon?: string
  color?: string
  sort_order?: number
  unit_id: string
}

export function useCreateCategory() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: ServiceCategoryCreatePayload) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('service_categories')
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-categories'] })
      toast.success('Categoria criada com sucesso.')
    },
    onError: (err, payload) =>
      toast.error(mapPgError(err, { activeUnitId: payload?.unit_id ?? null }, 'SERVICE_CATEGORY_CREATE')),
  })
}

// ─────────────────────────────────────────────────────────────
// useUpdateCategory
// ─────────────────────────────────────────────────────────────
export function useUpdateCategory() {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async (input: {
      id: string
      name?: string
      slug?: string
      description?: string
      icon?: string
      color?: string
      sort_order?: number
      is_active?: boolean
    }) => {
      const { id, ...patch } = input
      const supabase = createClient()
      const { data, error } = await supabase
        .from('service_categories')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-categories', activeUnitId] })
      toast.success('Categoria atualizada.')
    },
    onError: (err) => toast.error(mapPgError(err, {}, 'SERVICE_CATEGORY_UPDATE')),
  })
}

// ─────────────────────────────────────────────────────────────
// useDeleteCategory
// ─────────────────────────────────────────────────────────────
export function useDeleteCategory() {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('service_categories')
        .delete()
        .eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-categories', activeUnitId] })
      toast.success('Categoria removida.')
    },
    onError: (err) => toast.error(mapPgError(err, {}, 'SERVICE_CATEGORY_DELETE')),
  })
}
