'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'
import { useUnitStore } from '@/stores/unit-store'
import { toast } from 'sonner'
import type { PloomesSyncLog, PloomesWebhookLog, PloomesConfigRow } from '@/types/database.types'

const supabase = createClient()

// ── Query keys ────────────────────────────────────────────────

const KEYS = {
  webhookLogs: () => ['ploomes-webhook-logs'] as const,
  config:      (unitId: string | null) => ['ploomes-config', unitId] as const,
}

// ── useSyncLogs — últimos 10 registros de ploomes_sync_log ────

export function useSyncLogs() {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    // Logs de sync são globais (unit_id=null no cron) — sem filtro de unidade
    queryKey: ['ploomes-sync-logs'] as const,
    queryFn: async (): Promise<PloomesSyncLog[]> => {
      const { data, error } = await supabase
        .from('ploomes_sync_log')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10)

      if (error) throw error
      return data ?? []
    },
    enabled: isSessionReady,
    staleTime: 30_000,
    refetchInterval: 30_000,
    networkMode: 'always',
    retry: (count, err: unknown) => {
      const status = (err as { status?: number })?.status
      if (status === 401 || status === 403) return false
      return count < 2
    },
  })
}

// ── useWebhookLogs — últimos 20 registros de ploomes_webhook_log ─

export function useWebhookLogs() {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: KEYS.webhookLogs(),
    queryFn: async (): Promise<PloomesWebhookLog[]> => {
      const { data, error } = await supabase
        .from('ploomes_webhook_log')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(20)

      if (error) throw error
      return data ?? []
    },
    enabled: isSessionReady,
    staleTime: 15_000,
    refetchInterval: 30_000,
    networkMode: 'always',
    retry: (count, err: unknown) => {
      const status = (err as { status?: number })?.status
      if (status === 401 || status === 403) return false
      return count < 2
    },
  })
}

// ── useWebhookStats — contagens das últimas 24h por status ────
// Computado client-side a partir de useWebhookLogs (sem query extra)

export type WebhookStats = {
  total: number
  success: number
  error: number
  skipped: number
}

export function useWebhookStats(logs: PloomesWebhookLog[] | undefined): WebhookStats {
  if (!logs) return { total: 0, success: 0, error: 0, skipped: 0 }

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recent = logs.filter((l) => new Date(l.received_at) >= oneDayAgo)

  return {
    total:   recent.length,
    success: recent.filter((l) => l.status === 'success').length,
    error:   recent.filter((l) => l.status === 'error').length,
    skipped: recent.filter((l) =>
      l.status === 'skipped' || l.status === 'received' || l.status === 'processing'
    ).length,
  }
}

// ── usePloomesConfig — config da unidade ativa ────────────────

export function usePloomesConfig() {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const activeUnitId = useUnitStore((s) => s.activeUnitId)

  return useQuery({
    queryKey: KEYS.config(activeUnitId),
    queryFn: async (): Promise<PloomesConfigRow | null> => {
      let query = supabase
        .from('ploomes_config')
        .select('*')
        .eq('is_active', true)

      if (activeUnitId) {
        query = query.eq('unit_id', activeUnitId)
      }

      const { data } = await query.limit(1).single()
      return data ?? null
    },
    enabled: isSessionReady,
    staleTime: 5 * 60_000,
    retry: (count, err: unknown) => {
      const status = (err as { status?: number })?.status
      if (status === 401 || status === 403) return false
      return count < 2
    },
  })
}

// ── useTriggerSync — forçar sync manual ──────────────────────

export function useTriggerSync() {
  const queryClient = useQueryClient()
  const activeUnitId = useUnitStore((s) => s.activeUnitId)

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/ploomes/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_id: activeUnitId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `Erro HTTP ${res.status}`)
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Sync iniciado com sucesso')
      // Aguarda 5s para o sync terminar, depois revalida
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['ploomes-sync-logs'] })
        void queryClient.invalidateQueries({ queryKey: KEYS.webhookLogs() })
      }, 5_000)
    },
    onError: (err: Error) => {
      toast.error(`Falha ao sincronizar: ${err.message}`)
    },
  })
}

// ── useRegisterWebhook — registrar webhook no Ploomes ─────────

export function useRegisterWebhook() {
  const queryClient = useQueryClient()
  const activeUnitId = useUnitStore((s) => s.activeUnitId)

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/ploomes/webhook-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_id: activeUnitId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `Erro HTTP ${res.status}`)
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Webhook registrado no Ploomes com sucesso')
      void queryClient.invalidateQueries({ queryKey: KEYS.config(activeUnitId) })
    },
    onError: (err: Error) => {
      toast.error(`Falha ao registrar webhook: ${err.message}`)
    },
  })
}
