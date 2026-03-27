'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useUnitStore } from '@/stores/unit-store'
import type { Equipment, EquipmentStatus } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// FILTROS
// ─────────────────────────────────────────────────────────────

export type EquipmentFilters = {
  search?:    string
  category?:  string
  status?:    EquipmentStatus[]
  onlyActive?: boolean
}

// ─────────────────────────────────────────────────────────────
// LISTAR EQUIPAMENTOS
// ─────────────────────────────────────────────────────────────

export function useEquipment(filters: EquipmentFilters = {}) {
  const { search, category, status, onlyActive } = filters
  const { activeUnitId } = useUnitStore()

  return useQuery({
    queryKey: ['equipment', filters, activeUnitId],
    queryFn: async () => {
      const supabase = createClient()
      let q = supabase
        .from('equipment')
        .select('*')
        .order('name')

      if (activeUnitId) q = q.eq('unit_id', activeUnitId)
      if (search?.trim()) q = q.ilike('name', `%${search.trim()}%`)
      if (category) q = q.eq('category', category)
      if (status?.length) q = q.in('status', status)
      if (onlyActive) q = q.in('status', ['active', 'in_repair'])

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Equipment[]
    },
    staleTime: 30 * 1000,
  })
}

// ─────────────────────────────────────────────────────────────
// DETALHE
// ─────────────────────────────────────────────────────────────

export function useEquipmentItem(id: string) {
  return useQuery({
    queryKey: ['equipment', id],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('equipment')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Equipment
    },
    enabled: !!id,
    staleTime: 30 * 1000,
  })
}

// ─────────────────────────────────────────────────────────────
// HISTÓRICO DE MANUTENÇÕES DO EQUIPAMENTO
// ─────────────────────────────────────────────────────────────

export function useEquipmentMaintenanceHistory(equipmentId: string) {
  return useQuery({
    queryKey: ['equipment-maintenance-history', equipmentId],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('maintenance_orders')
        .select(`
          id, title, type, priority, status, created_at, due_date,
          sector:sectors(name),
          assigned_user:users!maintenance_orders_assigned_to_fkey(name)
        `)
        .eq('equipment_id', equipmentId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data ?? []
    },
    enabled: !!equipmentId,
    staleTime: 30 * 1000,
  })
}

// ─────────────────────────────────────────────────────────────
// CRIAR EQUIPAMENTO
// ─────────────────────────────────────────────────────────────

export function useCreateEquipment() {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async (data: Partial<Equipment>) => {
      const supabase = createClient()
      const { data: created, error } = await supabase
        .from('equipment')
        .insert({ ...data, unit_id: activeUnitId! })
        .select()
        .single()
      if (error) throw error
      return created as Equipment
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equipment'] })
      toast.success('Equipamento cadastrado com sucesso')
    },
    onError: (err: Error) => {
      toast.error(`Erro ao cadastrar equipamento: ${err.message}`)
    },
  })
}

// ─────────────────────────────────────────────────────────────
// ATUALIZAR EQUIPAMENTO
// ─────────────────────────────────────────────────────────────

export function useUpdateEquipment() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Equipment> }) => {
      const supabase = createClient()

      const { data: updated, error } = await supabase
        .from('equipment')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return updated as Equipment
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['equipment'] })
      qc.invalidateQueries({ queryKey: ['equipment', id] })
      toast.success('Equipamento atualizado com sucesso')
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar equipamento: ${err.message}`)
    },
  })
}

// ─────────────────────────────────────────────────────────────
// ALTERAR STATUS (desativar, aposentar, etc.)
// ─────────────────────────────────────────────────────────────

export function useChangeEquipmentStatus() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: EquipmentStatus }) => {
      const { data, error } = await createClient()
        .from('equipment')
        .update({ status })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Equipment
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['equipment'] })
      qc.invalidateQueries({ queryKey: ['equipment', updated.id] })
      toast.success('Status do equipamento atualizado')
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar status: ${err.message}`)
    },
  })
}

// ─────────────────────────────────────────────────────────────
// LISTAR CATEGORIAS ÚNICAS (para filtros)
// ─────────────────────────────────────────────────────────────

export function useEquipmentCategories() {
  const { activeUnitId } = useUnitStore()

  return useQuery({
    queryKey: ['equipment-categories', activeUnitId],
    queryFn: async () => {
      let q = createClient()
        .from('equipment')
        .select('category')
        .not('category', 'is', null)
        .order('category')
      if (activeUnitId) q = q.eq('unit_id', activeUnitId)
      const { data, error } = await q
      if (error) throw error
      const unique = [...new Set((data ?? []).map((r) => r.category as string))]
      return unique
    },
    staleTime: 5 * 60 * 1000,
  })
}
