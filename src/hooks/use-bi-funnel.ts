'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'

// ── Types ─────────────────────────────────────────────────────

export type FunnelStage = {
  stage_id: number
  stage_name: string
  total: number
  em_aberto: number
  ganhos: number
  perdidos: number
}

export type BIFunnelData = {
  stages: FunnelStage[]
  totalDeals: number
}

// ── Stage order: logical pipeline progression ──────────────────
// Qualificação → Aguardando → Apresentação → Proposta →
// Visita agendada → Já visitou → Negociação → Fechamento →
// Assinando Contrato → Festa Fechada

const FUNNEL_STAGE_ORDER: number[] = [
  60004414, // Qualificação
  60005196, // Aguardando
  60005554, // Apresentação (Já fez o segundo contato)
  60004724, // Proposta
  60005488, // Visita agendada
  60005487, // Já visitou
  60004415, // Negociação
  60004416, // Fechamento
  60056754, // Assinando Contrato
  60004787, // Festa Fechada
]

// ── Hook ──────────────────────────────────────────────────────

export function useBIFunnelData() {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['bi', 'funnel', activeUnitId],
    enabled: isSessionReady,
    staleTime: 5 * 60 * 1000,
    retry: (count, err: { status?: number } | null) =>
      count < 3 && err?.status !== 401 && err?.status !== 403,
    queryFn: async (): Promise<BIFunnelData> => {
      const supabase = createClient()

      const { data, error } = await supabase.rpc('get_bi_funnel_data', {
        p_unit_id: activeUnitId ?? null,
      })

      if (error) throw { status: error.code, message: error.message }

      const raw = (data ?? []) as FunnelStage[]

      // Sort by logical pipeline order; unknown stages go to the end
      const stageOrderMap = new Map(FUNNEL_STAGE_ORDER.map((id, i) => [id, i]))
      const stages = raw.slice().sort((a, b) => {
        const ai = stageOrderMap.get(a.stage_id) ?? 999
        const bi = stageOrderMap.get(b.stage_id) ?? 999
        return ai - bi
      })

      const totalDeals = stages.reduce((sum, s) => sum + s.total, 0)

      return { stages, totalDeals }
    },
  })
}
