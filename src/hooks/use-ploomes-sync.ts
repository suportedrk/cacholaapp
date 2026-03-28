'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { PloomesConfigRow } from '@/types/database.types'

// ── Types (espelham a resposta da API) ────────────────────────

export type PloomesSyncLog = {
  id: string
  started_at: string
  finished_at: string | null
  status: 'running' | 'success' | 'error'
  deals_found: number
  deals_created: number
  deals_updated: number
  deals_errors: number
  venues_created: number
  types_created: number
  error_message: string | null
  triggered_by: 'cron' | 'manual' | 'webhook'
  triggered_by_user_id: string | null
  unit_id: string | null
}

type SyncStatusResponse = {
  logs: PloomesSyncLog[]
  latest: PloomesSyncLog | null
  isRunning: boolean
}

type SyncResult = {
  dealsFound: number
  dealsCreated: number
  dealsUpdated: number
  dealsErrors: number
  venuesCreated: number
  typesCreated: number
  durationMs: number
}

// ── Hook: status e histórico ──────────────────────────────────

export function usePloomesSyncStatus() {
  return useQuery<SyncStatusResponse>({
    queryKey: ['ploomes', 'sync', 'status'],
    queryFn: async () => {
      const res = await fetch('/api/ploomes/sync/status')
      if (!res.ok) throw new Error('Erro ao buscar status do Ploomes.')
      return res.json() as Promise<SyncStatusResponse>
    },
    staleTime: 30_000,
    // Polling mais frequente quando sync está ativo
    refetchInterval: (query) => {
      const data = query.state.data as SyncStatusResponse | undefined
      return data?.isRunning ? 5_000 : 30_000
    },
  })
}

// ── Hook: disparar sync manual ────────────────────────────────

export function useTriggerPloomesSync() {
  const queryClient = useQueryClient()

  return useMutation<{ result: SyncResult }, Error, { unitId?: string }>({
    mutationFn: async ({ unitId } = {}) => {
      const res = await fetch('/api/ploomes/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_id: unitId ?? null }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Erro ao disparar sync.')
      }
      return res.json()
    },
    onSuccess: ({ result }) => {
      const { dealsCreated, dealsUpdated, dealsErrors } = result
      const parts: string[] = []
      if (dealsCreated > 0) parts.push(`${dealsCreated} criada${dealsCreated !== 1 ? 's' : ''}`)
      if (dealsUpdated > 0) parts.push(`${dealsUpdated} atualizada${dealsUpdated !== 1 ? 's' : ''}`)
      if (dealsErrors > 0)  parts.push(`${dealsErrors} erro${dealsErrors !== 1 ? 's' : ''}`)

      const summary = parts.length > 0 ? parts.join(', ') : 'nenhuma alteração'
      toast.success(`Sync concluído — ${summary}`)
      void queryClient.invalidateQueries({ queryKey: ['ploomes'] })
      void queryClient.invalidateQueries({ queryKey: ['events'] })
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })
}

// ── Hook: configuração Ploomes (ploomes_config) ───────────────

export function usePloomesConfig(unitId: string | null) {
  return useQuery<PloomesConfigRow | null>({
    queryKey: ['ploomes', 'config', unitId],
    queryFn: async () => {
      const params = unitId ? `?unit_id=${unitId}` : ''
      const res = await fetch(`/api/ploomes/config${params}`)
      if (!res.ok) throw new Error('Erro ao buscar configuração Ploomes.')
      const data = await res.json() as { config: PloomesConfigRow | null }
      return data.config
    },
    staleTime: 5 * 60_000,
  })
}

// ── Hook: verificar se integração Ploomes está ativa na unidade ──

export function usePloomesIntegrationActive(unitId: string | null) {
  return useQuery<boolean>({
    queryKey: ['ploomes', 'active', unitId],
    queryFn: async () => {
      const res = await fetch('/api/ploomes/sync/status')
      if (!res.ok) return false
      const data = await res.json() as SyncStatusResponse
      // Considera ativa se houve pelo menos 1 sync bem-sucedido
      return data.logs.some((l) => l.status === 'success')
    },
    staleTime: 5 * 60_000,
  })
}
