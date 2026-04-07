'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'

export type EventConflict = {
  event_id_a:    string
  event_id_b:    string
  conflict_date: string   // DATE → 'YYYY-MM-DD'
  gap_minutes:   number   // negativo = sobreposição
}

// ─────────────────────────────────────────────────────────────
// useEventConflicts
// Retorna os pares completos de conflito para a unidade ativa.
// Nota: requer activeUnitId não-nulo — a função SQL exige p_unit_id.
// Quando activeUnitId=null (visão consolidada super_admin), a query
// é desabilitada (não há UUID único para filtrar).
// ─────────────────────────────────────────────────────────────
export function useEventConflicts() {
  const { activeUnitId } = useUnitStore()
  const isSessionReady   = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery<EventConflict[]>({
    queryKey:  ['event-conflicts', activeUnitId],
    enabled:   isSessionReady && !!activeUnitId,
    staleTime: 5 * 60 * 1000,   // 5 min — conflitos mudam pouco
    retry: (count, error: unknown) => {
      const status = (error as { status?: number })?.status
      if (status === 401 || status === 403) return false
      return count < 2
    },
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .rpc('get_event_conflicts', { p_unit_id: activeUnitId! })
      if (error) throw error
      return (data ?? []) as EventConflict[]
    },
  })
}

// ─────────────────────────────────────────────────────────────
// useConflictingEventIds
// Retorna um Set memoizado com os IDs de todos os eventos
// que participam de algum conflito.
// Estável entre renders — só recriado quando `data` muda.
// ─────────────────────────────────────────────────────────────
export function useConflictingEventIds(): Set<string> {
  const { data } = useEventConflicts()

  return useMemo(() => {
    if (!data || data.length === 0) return new Set<string>()
    const ids = new Set<string>()
    for (const conflict of data) {
      ids.add(conflict.event_id_a)
      ids.add(conflict.event_id_b)
    }
    return ids
  }, [data])
}
