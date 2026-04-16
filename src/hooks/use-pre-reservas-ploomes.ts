'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'
import { useUnitStore } from '@/stores/unit-store'
import type { CalendarPreReserva } from '@/types/pre-reservas'

// Tipo raw retornado pela view (sem tipagem em database.types.ts ainda)
type PreReservaPloomesRow = {
  id: string
  deal_id: number
  unit_id: string
  date: string
  start_time: string | null
  end_time: string | null
  client_name: string | null
  client_contact: string | null
  deal_title: string | null
  deal_amount: number | null
  stage_id: number
  stage_name: string | null
  owner_name: string | null
  created_at: string
  updated_at: string
  ploomes_url: string
  source: string
}

/**
 * Busca pré-reservas derivadas de deals Ploomes em estágios
 * Fechamento (60004416) + Assinando Contrato (60056754) com status Em aberto.
 * - Read-only: fonte é ploomes_deals via VIEW.
 * - Range de datas recebe startDate/endDate (igual ao useCalendarPreReservas).
 */
export function usePreReservasPloomes(startDate: string, endDate: string) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const { activeUnitId } = useUnitStore()

  return useQuery({
    queryKey: ['pre-reservas-ploomes', startDate, endDate, activeUnitId] as const,
    queryFn: async (): Promise<CalendarPreReserva[]> => {
      const supabase = createClient()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('pre_reservas_ploomes_view')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true, nullsFirst: false })

      if (activeUnitId) {
        query = query.eq('unit_id', activeUnitId)
      }

      const { data, error } = await query
      if (error) throw error

      return ((data ?? []) as PreReservaPloomesRow[]).map((r) => ({
        id:             r.id,
        title:          r.client_name ?? r.deal_title ?? 'Sem nome',
        date:           r.date,
        start_time:     r.start_time ? r.start_time.substring(0, 5) : undefined,
        end_time:       r.end_time   ? r.end_time.substring(0, 5)   : undefined,
        type:           'pre-reserva' as const,
        description:    r.stage_name ? `${r.stage_name} — Ploomes` : 'Pré-reserva Ploomes',
        client_contact: r.client_contact,
        unit_id:        r.unit_id,
        source:         'ploomes' as const,
        ploomes_url:    r.ploomes_url,
        deal_amount:    r.deal_amount,
        stage_name:     r.stage_name,
        owner_name:     r.owner_name,
      }))
    },
    enabled: isSessionReady,
    staleTime: 60_000,
    networkMode: 'always',
    retry: (count, err: unknown) => {
      const status = (err as { status?: number })?.status
      if (status === 400 || status === 401 || status === 403) return false
      return count < 3
    },
  })
}
