'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'
import { toast } from 'sonner'
import type { MaintenanceItemWithSector } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
export type ItemInsert = {
  name: string
  description?: string | null
  sector_id?: string | null
  is_active?: boolean
  sort_order?: number
}

export type ItemUpdate = Partial<ItemInsert>

// ─────────────────────────────────────────────────────────────
// LIST (with sector join)
// ─────────────────────────────────────────────────────────────
export function useMaintenanceItems(onlyActive = false, sectorId?: string | null) {
  const activeUnitId = useUnitStore((s) => s.activeUnitId)
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery<MaintenanceItemWithSector[]>({
    queryKey: ['maintenance-items', activeUnitId, onlyActive, sectorId],
    enabled: isSessionReady,
    staleTime: 5 * 60 * 1000,
    retry: (count, err: unknown) => {
      const status = (err as { status?: number })?.status
      return count < 3 && status !== 401 && status !== 403
    },
    queryFn: async () => {
      const supabase = createClient()
      let q = supabase
        .from('maintenance_items')
        .select('*, sector:maintenance_sectors!sector_id(id, name)')
        .order('sort_order', { ascending: true })

      if (activeUnitId) q = q.eq('unit_id', activeUnitId)
      if (onlyActive) q = q.eq('is_active', true)
      if (sectorId) q = q.eq('sector_id', sectorId)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as MaintenanceItemWithSector[]
    },
  })
}

// ─────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────
export function useCreateMaintenanceItem() {
  const queryClient = useQueryClient()
  const activeUnitId = useUnitStore((s) => s.activeUnitId)

  return useMutation({
    mutationFn: async (payload: ItemInsert) => {
      const supabase = createClient()
      const { data: existing } = await supabase
        .from('maintenance_items')
        .select('sort_order')
        .eq('unit_id', activeUnitId ?? '')
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle()

      const sort_order = (existing?.sort_order ?? 0) + 1

      const { data, error } = await supabase
        .from('maintenance_items')
        .insert({ ...payload, unit_id: activeUnitId ?? undefined, sort_order })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-items'] })
      toast.success('Item criado com sucesso')
    },
    onError: () => toast.error('Erro ao criar item'),
  })
}

// ─────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────
export function useUpdateMaintenanceItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...payload }: ItemUpdate & { id: string }) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('maintenance_items')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-items'] })
    },
    onError: () => toast.error('Erro ao atualizar item'),
  })
}

// ─────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────
export function useDeleteMaintenanceItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('maintenance_items')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-items'] })
      toast.success('Item removido')
    },
    onError: () => toast.error('Erro ao remover item'),
  })
}
