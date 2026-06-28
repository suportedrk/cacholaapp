'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useAuthReadyStore } from '@/stores/auth-store'

export interface SalesTargetForPeriod {
  target_revenue: number
  target_deals:   number
  months_count:   number
}

function targetsRetry(count: number, err: unknown): boolean {
  const status = (err as { status?: number })?.status
  return count < 3 && status !== 401 && status !== 403
}

/**
 * Meta agregada do período (soma das metas mensais no intervalo). Espelha o
 * scoping do realizado: vendedora vê só a sua; gestor vê a do seller escolhido
 * ou, com sellerId null, a soma de todas as ativas. RPC SECURITY DEFINER guarda
 * por vendas:view.
 */
export function useSalesTarget(params: {
  sellerId:  string | null
  startDate: string
  endDate:   string
  enabled?:  boolean
}) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const { sellerId, startDate, endDate, enabled = true } = params

  return useQuery({
    queryKey:  ['vendas', 'target', sellerId, startDate, endDate],
    enabled:   isSessionReady && enabled && !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000,
    networkMode: 'always',
    retry:     targetsRetry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_sales_target_for_period', {
        p_seller_id:  sellerId,
        p_start_date: startDate,
        p_end_date:   endDate,
      })
      if (error) throw error
      const row = (data as SalesTargetForPeriod[] | null)?.[0]
      return row ?? { target_revenue: 0, target_deals: 0, months_count: 0 }
    },
  })
}

/** Upsert da meta de um mês (gestor). Invalida o cache de metas. */
export function useSetSalesTarget() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      sellerId:      string
      periodMonth:   string // 'YYYY-MM' ou 'YYYY-MM-01'
      targetRevenue: number
    }) => {
      const res = await fetch('/api/vendas/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seller_id:      input.sellerId,
          period_month:   input.periodMonth,
          target_revenue: input.targetRevenue,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Erro ao salvar a meta.')
      return body as { ok: boolean }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendas', 'target'] })
      toast.success('Meta salva.')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar a meta.')
    },
  })
}

/** Remove a meta de um mês (gestor). */
export function useDeleteSalesTarget() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { sellerId: string; periodMonth: string }) => {
      const res = await fetch('/api/vendas/targets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seller_id: input.sellerId, period_month: input.periodMonth }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Erro ao remover a meta.')
      return body as { ok: boolean }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendas', 'target'] })
      toast.success('Meta removida.')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover a meta.')
    },
  })
}
