'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'
import type { PloomesDealsRow } from '@/types/database.types'

// ── Types ─────────────────────────────────────────────────────

export type DrilldownParams = {
  stageId: number | null
  unitId: string | null
  statusFilter: number | null   // 1 = Em aberto, 2 = Ganho, 3 = Perdido; null = todos
  search: string
  page: number
  pageSize: number
}

export type DrilldownResult = {
  deals: PloomesDealsRow[]
  totalCount: number
}

// ── Hook ──────────────────────────────────────────────────────

export function useStageDrilldownDeals(params: DrilldownParams) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: [
      'bi-drilldown',
      params.stageId,
      params.unitId,
      params.statusFilter,
      params.search,
      params.page,
      params.pageSize,
    ],
    enabled: isSessionReady && !!params.stageId,
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
    retry: (count, err: { status?: number } | null) =>
      count < 3 && err?.status !== 401 && err?.status !== 403,
    queryFn: async (): Promise<DrilldownResult> => {
      const supabase = createClient()

      const from = params.page * params.pageSize
      const to   = (params.page + 1) * params.pageSize - 1

      let query = supabase
        .from('ploomes_deals')
        .select('*', { count: 'exact' })
        .eq('stage_id', params.stageId!)
        .order('ploomes_create_date', { ascending: false })
        .range(from, to)

      if (params.unitId) {
        query = query.eq('unit_id', params.unitId)
      }

      if (params.statusFilter != null) {
        query = query.eq('status_id', params.statusFilter)
      }

      if (params.search.trim()) {
        const s = params.search.trim()
        query = query.or(`title.ilike.%${s}%,contact_name.ilike.%${s}%`)
      }

      const { data, count, error } = await query
      if (error) throw { status: (error as { code?: string }).code, message: error.message }

      return { deals: (data ?? []) as PloomesDealsRow[], totalCount: count ?? 0 }
    },
  })
}
