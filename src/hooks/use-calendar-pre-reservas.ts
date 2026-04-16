'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'
import { useUnitStore } from '@/stores/unit-store'
import type { CalendarPreReserva, PreReservaDiretoria } from '@/types/pre-reservas'

// Tabela não está em database.types.ts ainda — cast via any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(supabase: ReturnType<typeof createClient>): any {
  return supabase
}

// ─────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────

/**
 * Busca pré-reservas da diretoria para o calendário.
 * - Todos os autenticados podem visualizar (RLS SELECT = true).
 * - Se activeUnitId estiver definido, filtra por unidade.
 * - Se activeUnitId for null ("Todas as unidades"), traz tudo.
 */
export function useCalendarPreReservas(startDate: string, endDate: string) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const { activeUnitId } = useUnitStore()

  return useQuery({
    queryKey: ['pre-reservas-diretoria', startDate, endDate, activeUnitId] as const,
    queryFn: async (): Promise<CalendarPreReserva[]> => {
      const supabase = createClient()

      let query = db(supabase)
        .from('pre_reservas_diretoria')
        .select('id, unit_id, date, start_time, end_time, client_name, client_contact, description, created_by')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })

      // Filtro opcional por unidade
      if (activeUnitId) {
        query = query.eq('unit_id', activeUnitId)
      }

      const { data, error } = await query
      if (error) throw error

      return ((data ?? []) as PreReservaDiretoria[]).map((r) => ({
        id:             r.id,
        title:          r.client_name,
        date:           r.date,
        start_time:     r.start_time ? r.start_time.substring(0, 5) : undefined,
        end_time:       r.end_time   ? r.end_time.substring(0, 5)   : undefined,
        type:           'pre-reserva' as const,
        description:    r.description,
        client_contact: r.client_contact,
        unit_id:        r.unit_id,
        created_by:     r.created_by,
        source:         'diretoria' as const,
      }))
    },
    enabled: isSessionReady,
    staleTime: 2 * 60_000,
    networkMode: 'always',
    retry: (count, err: unknown) => {
      const status = (err as { status?: number })?.status
      if (status === 400 || status === 401 || status === 403) return false
      return count < 3
    },
  })
}
