'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Sector } from '@/types/database.types'
import { useUnitStore } from '@/stores/unit-store'

// ─────────────────────────────────────────────────────────────
// LISTAR SETORES
// ─────────────────────────────────────────────────────────────
export function useSectors(onlyActive = true) {
  const { activeUnitId } = useUnitStore()
  return useQuery({
    queryKey: ['sectors', onlyActive, activeUnitId],
    queryFn: async () => {
      const supabase = createClient()
      let q = supabase.from('sectors').select('*').order('sort_order')
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
  const { activeUnitId } = useUnitStore()
  return useMutation({
    mutationFn: async (data: { name: string }) => {
      const supabase = createClient()
      let q = supabase.from('sectors').select('sort_order').order('sort_order', { ascending: false }).limit(1)
      if (activeUnitId) q = q.eq('unit_id', activeUnitId)
      const { data: existing } = await q
      const nextOrder = ((existing?.[0]?.sort_order ?? 0) as number) + 1
      const { error } = await supabase.from('sectors').insert({ ...data, sort_order: nextOrder, unit_id: activeUnitId! })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sectors'] }); toast.success('Setor criado.') },
    onError: () => toast.error('Erro ao criar setor.'),
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
      const { error } = await supabase.from('sectors').update(data).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sectors'] }); toast.success('Setor atualizado.') },
    onError: () => toast.error('Erro ao atualizar setor.'),
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
      const { error } = await supabase.from('sectors').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sectors'] }); toast.success('Setor desativado.') },
    onError: () => toast.error('Erro ao desativar setor.'),
  })
}
