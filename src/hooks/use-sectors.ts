'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Sector } from '@/types/database.types'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'
import { mapPgError } from '@/lib/errors/map-pg-error'

// ─────────────────────────────────────────────────────────────
// LISTAR SETORES
// ─────────────────────────────────────────────────────────────
export function useSectors(onlyActive = true, unitIdOverride?: string | null) {
  const storeUnitId = useUnitStore((s) => s.activeUnitId)
  const activeUnitId = unitIdOverride !== undefined ? unitIdOverride : storeUnitId
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  return useQuery({
    queryKey: ['sectors', onlyActive, activeUnitId],
    enabled: isSessionReady,
    queryFn: async () => {
      const supabase = createClient()
      let q = supabase.from('maintenance_sectors').select('*').order('sort_order')
      if (activeUnitId) q = q.eq('unit_id', activeUnitId)
      if (onlyActive) q = q.eq('is_active', true)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Sector[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

// ─────────────────────────────────────────────────────────────
// CRIAR SETOR
// ─────────────────────────────────────────────────────────────
export function useCreateSector() {
  const qc = useQueryClient()
  const storeUnitId = useUnitStore((s) => s.activeUnitId)
  return useMutation({
    mutationFn: async (data: { name: string; unit_id?: string | null }) => {
      const supabase = createClient()
      const targetUnitId = data.unit_id ?? storeUnitId
      let q = supabase.from('maintenance_sectors').select('sort_order').order('sort_order', { ascending: false }).limit(1)
      if (targetUnitId) q = q.eq('unit_id', targetUnitId)
      const { data: existing } = await q
      const nextOrder = ((existing?.[0]?.sort_order ?? 0) as number) + 1
      const { error } = await supabase.from('maintenance_sectors').insert({ name: data.name, sort_order: nextOrder, unit_id: targetUnitId! })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sectors'] }); toast.success('Setor criado.') },
    onError: (err) => toast.error(mapPgError(err, { activeUnitId: storeUnitId }, 'SECTOR_CREATE')),
  })
}

// ─────────────────────────────────────────────────────────────
// ATUALIZAR SETOR
// ─────────────────────────────────────────────────────────────
export function useUpdateSector() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Sector> }) => {
      const supabase = createClient()
      const { error } = await supabase.from('maintenance_sectors').update(data).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sectors'] }); toast.success('Setor atualizado.') },
    onError: (err) => toast.error(mapPgError(err, {}, 'SECTOR_UPDATE')),
  })
}

// ─────────────────────────────────────────────────────────────
// DESATIVAR SETOR (soft delete)
// ─────────────────────────────────────────────────────────────
export function useDeleteSector() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('maintenance_sectors').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sectors'] }); toast.success('Setor desativado.') },
    onError: (err) => toast.error(mapPgError(err, {}, 'SECTOR_DELETE')),
  })
}
