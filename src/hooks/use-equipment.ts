'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'
import { useAuth } from '@/hooks/use-auth'
import type { Equipment, EquipmentStatus } from '@/types/database.types'
import { mapPgError } from '@/lib/errors/map-pg-error'

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

export function useEquipment(
  filters: EquipmentFilters = {},
  unitIdOverride?: string | null,
) {
  const { search, category, status, onlyActive } = filters
  const storeUnitId = useUnitStore((s) => s.activeUnitId)
  const activeUnitId = unitIdOverride !== undefined ? unitIdOverride : storeUnitId
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['equipment', filters, activeUnitId],
    enabled: isSessionReady,
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
        .from('maintenance_tickets')
        .select(`
          id, title, nature, urgency, status, created_at, due_at,
          sector:maintenance_sectors!sector_id(name),
          opened_by_user:users!opened_by(name)
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

// O payload exige `unit_id` explicitamente — o caller é quem decide a unidade
// (Fase 4b: formulários usam `useFormUnitSelection` quando o seletor global está em
// "Todas as unidades"). Hook deixou de ler do `useUnitStore` para evitar `unit_id = null`
// silencioso quando `activeUnitId === null`.
export type EquipmentCreatePayload = Partial<Equipment> & { unit_id: string }

export function useCreateEquipment() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (data: EquipmentCreatePayload) => {
      const supabase = createClient()
      const { data: created, error } = await supabase
        .from('equipment')
        .insert(data)
        .select()
        .single()
      if (error) throw error
      return created as Equipment
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equipment'] })
      toast.success('Equipamento cadastrado com sucesso')
    },
    onError: (err, payload) =>
      toast.error(mapPgError(err, { activeUnitId: payload?.unit_id ?? null }, 'EQUIPMENT_CREATE')),
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
    onError: (err) => toast.error(mapPgError(err, {}, 'EQUIPMENT_UPDATE')),
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
    onError: (err) => toast.error(mapPgError(err, {}, 'EQUIPMENT_STATUS_UPDATE')),
  })
}

// ─────────────────────────────────────────────────────────────
// PERMISSÃO DE DELETE (via check_permission no banco)
// ─────────────────────────────────────────────────────────────

export function useEquipmentDeletePermission() {
  const isSessionReady = useAuthReadyStore((s: { isSessionReady: boolean }) => s.isSessionReady)
  const { profile } = useAuth()
  const userId = profile?.id

  return useQuery<boolean>({
    queryKey: ['equipment-delete-permission', userId],
    enabled: isSessionReady && !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await createClient().rpc('check_permission', {
        p_user_id: userId!,
        p_module: 'equipamentos',
        p_action: 'delete',
      })
      if (error) throw error
      return data === true
    },
  })
}

// ─────────────────────────────────────────────────────────────
// EXCLUIR EQUIPAMENTO
// Protege histórico: não permite excluir se houver chamados vinculados.
// ─────────────────────────────────────────────────────────────

export function useDeleteEquipment() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()

      const { count, error: countError } = await supabase
        .from('maintenance_tickets')
        .select('id', { count: 'exact', head: true })
        .eq('equipment_id', id)
      if (countError) throw countError

      if ((count ?? 0) > 0) {
        throw new Error(
          `Este equipamento possui ${count} chamado${(count ?? 0) > 1 ? 's' : ''} vinculado${(count ?? 0) > 1 ? 's' : ''}. Desative-o em vez de excluir para preservar o histórico.`,
        )
      }

      const { error } = await supabase.from('equipment').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equipment'] })
      toast.success('Equipamento excluído com sucesso')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─────────────────────────────────────────────────────────────
// LISTAR CATEGORIAS ÚNICAS (para filtros)
// ─────────────────────────────────────────────────────────────

export function useEquipmentCategories() {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['equipment-categories', activeUnitId],
    enabled: isSessionReady,
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
