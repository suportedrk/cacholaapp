'use client'

// ============================================================
// Hook — Dados de Origem de Leads por Unidade (BI)
// ============================================================
// Chama a RPC get_bi_lead_origin_breakdown(p_unit_id, p_period_months).
// Diferente dos outros hooks de BI, recebe o unitId EXPLICITAMENTE
// como parâmetro (não usa activeUnitId) porque o painel renderiza
// UM gráfico POR UNIDADE simultaneamente.
// ============================================================

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'

export type LeadOriginRow = {
  month_start: string  // 'YYYY-MM-DD' (DATE retornado pelo PostgreSQL)
  category:    string
  total:       number
}

/**
 * Busca a distribuição de origens de leads por mês para uma unidade específica.
 *
 * @param unitId - UUID da unidade (string não nula)
 * @param months - Número de meses retroativos (3, 6, 12 ou 24 = "Tudo")
 */
export function useLeadOriginBreakdown(unitId: string, months: number) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['bi', 'lead-origin', unitId, months],
    enabled:  isSessionReady && !!unitId,
    staleTime: 5 * 60 * 1000,
    retry: (count, err: { status?: number } | null) =>
      count < 3 && err?.status !== 401 && err?.status !== 403,
    queryFn: async (): Promise<LeadOriginRow[]> => {
      const supabase = createClient()
      // (supabase as any) necessário: database.types.ts não inclui RPCs adicionadas
      // após a última geração. Padrão do projeto (ver use-bi-category.ts, use-bi-sales.ts).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_bi_lead_origin_breakdown', {
        p_unit_id:       unitId,
        p_period_months: months,
      })
      if (error) throw { status: (error as { code: string }).code, message: (error as { message: string }).message }
      return (data ?? []) as unknown as LeadOriginRow[]
    },
  })
}
