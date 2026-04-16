'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'
import type { CalendarPreReserva } from '@/types/pre-reservas'

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
// que participam de algum conflito (qualquer tipo).
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

// ─────────────────────────────────────────────────────────────
// useOverlappingEventIds
// IDs de eventos com sobreposição direta (gap_minutes <= 0).
// ─────────────────────────────────────────────────────────────
export function useOverlappingEventIds(): Set<string> {
  const { data } = useEventConflicts()

  return useMemo(() => {
    if (!data || data.length === 0) return new Set<string>()
    const today = new Date().toISOString().split('T')[0]
    const ids = new Set<string>()
    for (const c of data) {
      if (c.conflict_date < today) continue
      if (c.gap_minutes <= 0) {
        ids.add(c.event_id_a)
        ids.add(c.event_id_b)
      }
    }
    return ids
  }, [data])
}

// ─────────────────────────────────────────────────────────────
// useShortGapEventIds
// IDs de eventos com intervalo insuficiente (0 < gap_minutes < 120).
// ─────────────────────────────────────────────────────────────
export function useShortGapEventIds(): Set<string> {
  const { data } = useEventConflicts()

  return useMemo(() => {
    if (!data || data.length === 0) return new Set<string>()
    const today = new Date().toISOString().split('T')[0]
    const ids = new Set<string>()
    for (const c of data) {
      if (c.conflict_date < today) continue
      if (c.gap_minutes > 0 && c.gap_minutes < 120) {
        ids.add(c.event_id_a)
        ids.add(c.event_id_b)
      }
    }
    return ids
  }, [data])
}

// ─────────────────────────────────────────────────────────────
// computePreReservaConflicts
// Computa client-side os conflitos entre pré-reservas e eventos
// (e entre pré-reservas entre si) na mesma data.
//
// Requer start_time + end_time em ambos para detectar conflito.
// Retorna Sets de IDs afetados (4 conjuntos separados).
// ─────────────────────────────────────────────────────────────

type IntervalItem = {
  id:         string
  date:       string
  start_time: string | null
  end_time:   string | null
}

export type PRConflictResult = {
  /** IDs de pré-reservas com sobreposição direta */
  prOverlapIds:        Set<string>
  /** IDs de pré-reservas com intervalo < 2h (sem sobreposição) */
  prShortGapIds:       Set<string>
  /** IDs de eventos que colidem (sobreposição) com alguma pré-reserva */
  eventOverlapFromPR:  Set<string>
  /** IDs de eventos com intervalo < 2h com alguma pré-reserva */
  eventShortGapFromPR: Set<string>
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function computePreReservaConflicts(
  events:      IntervalItem[],
  preReservas: CalendarPreReserva[],
): PRConflictResult {
  const result: PRConflictResult = {
    prOverlapIds:        new Set(),
    prShortGapIds:       new Set(),
    eventOverlapFromPR:  new Set(),
    eventShortGapFromPR: new Set(),
  }

  // Pré-reservas precisam ter start_time e end_time para checar conflito
  const checkablePRs = preReservas.filter((pr) => pr.start_time && pr.end_time)
  if (checkablePRs.length === 0) return result

  // Eventos com tempo completo, indexados por data
  const eventsByDate = new Map<string, IntervalItem[]>()
  for (const ev of events) {
    if (!ev.start_time || !ev.end_time) continue
    const arr = eventsByDate.get(ev.date) ?? []
    arr.push(ev)
    eventsByDate.set(ev.date, arr)
  }

  for (const pr of checkablePRs) {
    const prStart = timeToMinutes(pr.start_time!.substring(0, 5))
    const prEnd   = timeToMinutes(pr.end_time!.substring(0, 5))

    // Pré-reserva vs eventos na mesma data
    for (const ev of (eventsByDate.get(pr.date) ?? [])) {
      const evStart = timeToMinutes(ev.start_time!.substring(0, 5))
      const evEnd   = timeToMinutes(ev.end_time!.substring(0, 5))
      // gap positivo = espaço entre os intervalos; <= 0 = sobreposição
      const gap = Math.max(evStart - prEnd, prStart - evEnd)
      if (gap <= 0) {
        result.prOverlapIds.add(pr.id)
        result.eventOverlapFromPR.add(ev.id)
      } else if (gap < 120) {
        if (!result.prOverlapIds.has(pr.id))       result.prShortGapIds.add(pr.id)
        if (!result.eventOverlapFromPR.has(ev.id)) result.eventShortGapFromPR.add(ev.id)
      }
    }

    // Pré-reserva vs outras pré-reservas na mesma data
    for (const other of checkablePRs) {
      if (other.id === pr.id || other.date !== pr.date) continue
      const otStart = timeToMinutes(other.start_time!.substring(0, 5))
      const otEnd   = timeToMinutes(other.end_time!.substring(0, 5))
      const gap = Math.max(otStart - prEnd, prStart - otEnd)
      if (gap <= 0) {
        result.prOverlapIds.add(pr.id)
        result.prOverlapIds.add(other.id)
      } else if (gap < 120) {
        if (!result.prOverlapIds.has(pr.id))    result.prShortGapIds.add(pr.id)
        if (!result.prOverlapIds.has(other.id)) result.prShortGapIds.add(other.id)
      }
    }
  }

  return result
}
