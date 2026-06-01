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
      let q = supabase.from('maintenance_sectors').select('*').order('name')
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
// Verifica se existe setor inativo com o mesmo nome (case-insensitive).
// Se sim: reativa em vez de inserir — histórico de relatórios fica unificado.
// Se não: insert normal.
// mutationFn retorna void para manter compatibilidade com ConfigTable.onCreate.
// Resultado (criado/reativado) é comunicado via closure variable.
// ─────────────────────────────────────────────────────────────
export function useCreateSector() {
  const qc = useQueryClient()
  const storeUnitId = useUnitStore((s) => s.activeUnitId)
  // Objeto mutable para comunicar resultado de mutationFn → onSuccess sem
  // reatribuição de variável primitiva (evita regra ESLint no-outer-reassignment).
  const _result = { reactivated: false }

  return useMutation({
    mutationFn: async (data: { name: string; unit_id?: string | null }) => {
      _result.reactivated = false
      const supabase = createClient()
      const targetUnitId = data.unit_id ?? storeUnitId
      const trimmedName = data.name.trim()

      // Verificar se existe setor arquivado com o mesmo nome (case-insensitive)
      let checkQ = supabase
        .from('maintenance_sectors')
        .select('id')
        .eq('is_active', false)
        .ilike('name', trimmedName)
        .limit(1)
      if (targetUnitId) checkQ = checkQ.eq('unit_id', targetUnitId)
      const { data: archived } = await checkQ

      if (archived?.[0]) {
        // Reativar o registro existente — preserva o sector_id nos chamados históricos
        const { error } = await supabase
          .from('maintenance_sectors')
          .update({ is_active: true, name: trimmedName })
          .eq('id', archived[0].id)
        if (error) throw error
        _result.reactivated = true
        return
      }

      // Insert normal
      let q = supabase.from('maintenance_sectors').select('sort_order').order('sort_order', { ascending: false }).limit(1)
      if (targetUnitId) q = q.eq('unit_id', targetUnitId)
      const { data: existing } = await q
      const nextOrder = ((existing?.[0]?.sort_order ?? 0) as number) + 1
      const { error } = await supabase
        .from('maintenance_sectors')
        .insert({ name: trimmedName, sort_order: nextOrder, unit_id: targetUnitId! })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sectors'] })
      toast.success(_result.reactivated ? 'Setor reativado — histórico preservado.' : 'Setor criado.')
    },
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
// REMOVER SETOR — 3 caminhos:
//   1. Chamados em aberto → bloqueia com mensagem clara
//   2. Só chamados encerrados/cancelados → soft-delete (preserva sector_id no histórico)
//   3. Nenhum chamado → hard-delete (remoção física)
// ─────────────────────────────────────────────────────────────
export function useDeleteSector() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()

      // Contar TODOS os chamados que referenciam este setor
      const { count: total } = await supabase
        .from('maintenance_tickets')
        .select('id', { count: 'exact', head: true })
        .eq('sector_id', id)

      if ((total ?? 0) > 0) {
        // Há chamados: verificar se algum está em aberto
        const { count: open } = await supabase
          .from('maintenance_tickets')
          .select('id', { count: 'exact', head: true })
          .eq('sector_id', id)
          .not('status', 'in', '(concluded,cancelled)')

        if ((open ?? 0) > 0) {
          // Caminho 1: chamados em aberto — bloquear
          throw new Error(
            `Este setor tem ${open} chamado${open !== 1 ? 's' : ''} em aberto. Encerre ou reatribua antes de excluir.`
          )
        }

        // Caminho 2: só chamados encerrados/cancelados — soft-delete preserva o histórico
        const { error } = await supabase
          .from('maintenance_sectors')
          .update({ is_active: false })
          .eq('id', id)
        if (error) throw error
        return
      }

      // Caminho 3: nenhum chamado — hard-delete
      const { error } = await supabase
        .from('maintenance_sectors')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sectors'] })
      toast.success('Setor removido.')
    },
    onError: (err: Error) => {
      const code = (err as { code?: string })?.code
      const msg = code
        ? mapPgError(err, {}, 'SECTOR_DELETE')
        : (err.message || 'Erro ao remover setor.')
      toast.error(msg)
    },
  })
}
