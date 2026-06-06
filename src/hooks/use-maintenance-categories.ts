'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'
import { toast } from 'sonner'
import type { MaintenanceCategory } from '@/types/database.types'
import { mapPgError } from '@/lib/errors/map-pg-error'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
export type CategoryInsert = {
  name: string
  color: string
  icon: string
  is_active?: boolean
  sort_order?: number
}

export type CategoryUpdate = Partial<CategoryInsert>

// ─────────────────────────────────────────────────────────────
// LIST
// Migration 152: categorias são GLOBAIS (unit_id NULL) — lista única
// válida para todas as unidades. Sem filtro por unidade; ordem alfabética.
// ─────────────────────────────────────────────────────────────
export function useMaintenanceCategories(onlyActive = false) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery<MaintenanceCategory[]>({
    queryKey: ['maintenance-categories', onlyActive],
    enabled: isSessionReady,
    staleTime: 5 * 60 * 1000,
    retry: (count, err: unknown) => {
      const status = (err as { status?: number })?.status
      return count < 3 && status !== 401 && status !== 403
    },
    queryFn: async () => {
      const supabase = createClient()
      let q = supabase
        .from('maintenance_categories')
        .select('*')
        .order('name', { ascending: true })

      if (onlyActive) q = q.eq('is_active', true)

      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
  })
}

// ─────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────
export function useCreateMaintenanceCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    // Migration 152: categoria nasce GLOBAL (unit_id NULL).
    mutationFn: async (payload: CategoryInsert) => {
      const supabase = createClient()

      // sort_order calculado sobre toda a lista (global)
      const { data: existing } = await supabase
        .from('maintenance_categories')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle()

      const sort_order = (existing?.sort_order ?? 0) + 1

      const { data, error } = await supabase
        .from('maintenance_categories')
        .insert({ ...payload, unit_id: null, sort_order })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-categories'] })
      toast.success('Categoria criada com sucesso')
    },
    onError: (err) => {
      const msg = (err as { code?: string })?.code === '23505'
        ? 'Já existe uma categoria com esse nome.'
        : mapPgError(err, {}, 'CATEGORY_CREATE')
      toast.error(msg)
    },
  })
}

// ─────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────
export function useUpdateMaintenanceCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...payload }: CategoryUpdate & { id: string }) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('maintenance_categories')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-categories'] })
    },
    onError: (err) => toast.error(mapPgError(err, {}, 'CATEGORY_UPDATE')),
  })
}

// ─────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────
export function useDeleteMaintenanceCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('maintenance_categories')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-categories'] })
      toast.success('Categoria removida')
    },
    onError: (err) => toast.error(mapPgError(err, {}, 'CATEGORY_DELETE')),
  })
}
