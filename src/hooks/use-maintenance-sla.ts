'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'
import { toast } from 'sonner'
import type { MaintenanceSla } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// URGENCY ORDER (para exibição consistente)
// ─────────────────────────────────────────────────────────────
const URGENCY_ORDER = ['critical', 'high', 'medium', 'low'] as const
export type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low'

// ─────────────────────────────────────────────────────────────
// LIST (sempre os 4 níveis, ordenados)
// ─────────────────────────────────────────────────────────────
export function useMaintenanceSla() {
  const activeUnitId = useUnitStore((s) => s.activeUnitId)
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery<MaintenanceSla[]>({
    queryKey: ['maintenance-sla', activeUnitId],
    enabled: isSessionReady,
    staleTime: 5 * 60 * 1000,
    retry: (count, err: unknown) => {
      const status = (err as { status?: number })?.status
      return count < 3 && status !== 401 && status !== 403
    },
    queryFn: async () => {
      const supabase = createClient()
      let q = supabase
        .from('maintenance_sla')
        .select('*')

      if (activeUnitId) q = q.eq('unit_id', activeUnitId)

      const { data, error } = await q
      if (error) throw error

      // Garantir ordem correta mesmo que o banco retorne em outra ordem
      return (data ?? []).sort(
        (a, b) =>
          URGENCY_ORDER.indexOf(a.urgency_level as UrgencyLevel) -
          URGENCY_ORDER.indexOf(b.urgency_level as UrgencyLevel)
      )
    },
  })
}

// ─────────────────────────────────────────────────────────────
// UPSERT (por urgency_level — UNIQUE constraint garante 1 row)
// ─────────────────────────────────────────────────────────────
export function useUpsertMaintenanceSla() {
  const queryClient = useQueryClient()
  const activeUnitId = useUnitStore((s) => s.activeUnitId)

  return useMutation({
    mutationFn: async (payload: {
      urgency_level: UrgencyLevel
      response_hours: number
      resolution_hours: number
    }) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('maintenance_sla')
        .upsert(
          {
            unit_id: activeUnitId,
            urgency_level: payload.urgency_level,
            response_hours: payload.response_hours,
            resolution_hours: payload.resolution_hours,
          },
          { onConflict: 'unit_id,urgency_level' }
        )
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-sla'] })
      toast.success('SLA atualizado')
    },
    onError: () => toast.error('Erro ao salvar SLA'),
  })
}
