'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'
import type { EquipmentCategory } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// LISTAR (com opção de filtrar só ativas)
// ─────────────────────────────────────────────────────────────

export function useEquipmentCategoryItems(onlyActive = false) {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['equipment-category-items', activeUnitId, onlyActive],
    enabled: isSessionReady,
    queryFn: async () => {
      const supabase = createClient()
      let q = supabase
        .from('equipment_categories')
        .select('*')
        .order('sort_order')
        .order('name')
      if (activeUnitId) q = q.eq('unit_id', activeUnitId)
      if (onlyActive)   q = q.eq('is_active', true)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as EquipmentCategory[]
    },
    staleTime: 30 * 1000,
  })
}

// ─────────────────────────────────────────────────────────────
// CRIAR
// ─────────────────────────────────────────────────────────────

export function useCreateEquipmentCategory() {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async (data: { name: string }) => {
      if (!activeUnitId) throw new Error('Nenhuma unidade selecionada')
      const supabase = createClient()

      // Calcula próximo sort_order
      const { data: existing } = await supabase
        .from('equipment_categories')
        .select('sort_order')
        .eq('unit_id', activeUnitId)
        .order('sort_order', { ascending: false })
        .limit(1)
      const nextOrder = existing?.[0] ? existing[0].sort_order + 1 : 0

      const { data: created, error } = await supabase
        .from('equipment_categories')
        .insert({ ...data, unit_id: activeUnitId, sort_order: nextOrder })
        .select()
        .single()
      if (error) throw error
      return created as EquipmentCategory
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equipment-category-items'] })
      toast.success('Categoria criada')
    },
    onError: (err: Error) => toast.error(`Erro ao criar categoria: ${err.message}`),
  })
}

// ─────────────────────────────────────────────────────────────
// ATUALIZAR
// ─────────────────────────────────────────────────────────────

export function useUpdateEquipmentCategory() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EquipmentCategory> }) => {
      const { data: updated, error } = await createClient()
        .from('equipment_categories')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return updated as EquipmentCategory
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equipment-category-items'] })
    },
    onError: (err: Error) => toast.error(`Erro ao atualizar categoria: ${err.message}`),
  })
}

// ─────────────────────────────────────────────────────────────
// EXCLUIR
// ─────────────────────────────────────────────────────────────

export function useDeleteEquipmentCategory() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient()
        .from('equipment_categories')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equipment-category-items'] })
      toast.success('Categoria removida')
    },
    onError: (err: Error) => toast.error(`Erro ao remover categoria: ${err.message}`),
  })
}
