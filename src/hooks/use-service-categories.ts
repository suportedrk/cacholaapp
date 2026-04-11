'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'
import type { ServiceCategory } from '@/types/providers'

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
export function useCreateCategory() {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async (input: {
      name: string
      slug: string
      description?: string
      icon?: string
      color?: string
      sort_order?: number
    }) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('service_categories')
        .insert({ ...input, unit_id: activeUnitId! })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-categories', activeUnitId] })
      toast.success('Categoria criada com sucesso.')
    },
    onError: () => toast.error('Erro ao criar categoria.'),
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
    onError: () => toast.error('Erro ao atualizar categoria.'),
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
    onError: () => toast.error('Erro ao remover categoria. Verifique se há prestadores vinculados.'),
  })
}
