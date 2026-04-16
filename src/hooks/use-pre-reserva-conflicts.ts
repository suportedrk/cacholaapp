'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'
import type { PRConflictResult } from '@/hooks/use-event-conflicts'

// ─────────────────────────────────────────────────────────────
// TIPO RAW (retorno do RPC)
// ─────────────────────────────────────────────────────────────
type PreReservaConflictRow = {
  pr_id:              string
  pr_source:          'diretoria' | 'ploomes'
  conflict_with_id:   string
  conflict_with_type: 'event' | 'pre_reserva'
  conflict_date:      string
  gap_minutes:        number
}

// ─────────────────────────────────────────────────────────────
// HOOK — busca conflitos PR×evento e PR×PR via RPC server-side
// Substitui computePreReservaConflicts (client-side, limitado à
// página carregada). Retorna a mesma forma PRConflictResult para
// compatibilidade com o código existente.
// ─────────────────────────────────────────────────────────────
export function usePreReservaConflicts() {
  const { activeUnitId } = useUnitStore()
  const isSessionReady   = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery<PreReservaConflictRow[]>({
    queryKey:  ['pre-reserva-conflicts', activeUnitId],
    enabled:   isSessionReady && !!activeUnitId,
    staleTime: 5 * 60 * 1000,   // 5 min — consistente com useEventConflicts
    retry: (count, error: unknown) => {
      const status = (error as { status?: number })?.status
      if (status === 401 || status === 403) return false
      return count < 2
    },
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .rpc('get_pre_reserva_conflicts', { p_unit_id: activeUnitId! })
      if (error) throw error
      return (data ?? []) as PreReservaConflictRow[]
    },
  })
}

// ─────────────────────────────────────────────────────────────
// HOOK derivado — retorna PRConflictResult (Sets de IDs)
// compatível com o shape de computePreReservaConflicts.
// Inclui também eventConflictIds para atualizar os chips.
// ─────────────────────────────────────────────────────────────
export function usePreReservaConflictSets(): PRConflictResult & {
  eventOverlapFromPR:  Set<string>
  eventShortGapFromPR: Set<string>
} {
  const { data } = usePreReservaConflicts()

  return useMemo((): PRConflictResult & {
    eventOverlapFromPR:  Set<string>
    eventShortGapFromPR: Set<string>
  } => {
    const prOverlapIds        = new Set<string>()
    const prShortGapIds       = new Set<string>()
    const eventOverlapFromPR  = new Set<string>()
    const eventShortGapFromPR = new Set<string>()

    if (!data || data.length === 0) {
      return { prOverlapIds, prShortGapIds, eventOverlapFromPR, eventShortGapFromPR }
    }

    const today = new Date().toISOString().split('T')[0]

    for (const row of data) {
      if (row.conflict_date < today) continue
      const isOverlap   = row.gap_minutes <  0
      const isShortGap  = row.gap_minutes >= 0 && row.gap_minutes < 120

      if (isOverlap) {
        prOverlapIds.add(row.pr_id)
        if (row.conflict_with_type === 'event') {
          eventOverlapFromPR.add(row.conflict_with_id)
        } else {
          // PR vs PR — o outro lado também é uma pré-reserva conflitante
          prOverlapIds.add(row.conflict_with_id)
        }
      } else if (isShortGap) {
        if (!prOverlapIds.has(row.pr_id))             prShortGapIds.add(row.pr_id)
        if (row.conflict_with_type === 'event') {
          if (!eventOverlapFromPR.has(row.conflict_with_id)) {
            eventShortGapFromPR.add(row.conflict_with_id)
          }
        } else {
          if (!prOverlapIds.has(row.conflict_with_id)) {
            prShortGapIds.add(row.conflict_with_id)
          }
        }
      }
    }

    return { prOverlapIds, prShortGapIds, eventOverlapFromPR, eventShortGapFromPR }
  }, [data])
}
