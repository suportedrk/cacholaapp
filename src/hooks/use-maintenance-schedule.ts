'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'

export interface ScheduledExecution {
  id: string
  ticket_id: string
  ticket_title: string
  executor_type: 'internal' | 'external'
  status: string
  scheduled_at: string                 // ISO (timestamptz)
  estimated_duration_minutes: number | null
  internal_user: { id: string; name: string } | null
  responsible_user: { id: string; name: string } | null
  provider: { id: string; name: string } | null
}

/**
 * Execuções de manutenção AGENDADAS (scheduled_at preenchido) numa janela de datas.
 * A RLS de maintenance_executions já filtra por permissão + unidade do usuário.
 *
 * @param dateFrom 'YYYY-MM-DD' inclusivo (início do dia)
 * @param dateTo   'YYYY-MM-DD' inclusivo (fim do dia)
 */
export function useMaintenanceSchedule(dateFrom: string, dateTo: string) {
  const activeUnitId = useUnitStore((s) => s.activeUnitId)
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['maintenance-schedule', dateFrom, dateTo, activeUnitId],
    enabled: isSessionReady && !!dateFrom && !!dateTo,
    staleTime: 30 * 1000,
    retry: (count, err: unknown) => {
      const status = (err as { status?: number })?.status
      return count < 3 && status !== 401 && status !== 403
    },
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('maintenance_executions')
        .select(`
          id, ticket_id, executor_type, status, scheduled_at, estimated_duration_minutes,
          internal_user:users!internal_user_id(id, name),
          responsible_user:users!maintenance_executions_responsible_user_id_fkey(id, name),
          provider:service_providers!provider_id(id, name),
          ticket:maintenance_tickets!ticket_id(id, title, unit_id)
        `)
        .gte('scheduled_at', `${dateFrom}T00:00:00`)
        .lte('scheduled_at', `${dateTo}T23:59:59`)
        .order('scheduled_at', { ascending: true })
      if (error) throw error

      // Filtro de unidade client-side via o ticket (a RLS já restringe ao escopo).
      const rows = (data ?? []) as unknown as Array<{
        id: string; ticket_id: string; executor_type: 'internal' | 'external'
        status: string; scheduled_at: string; estimated_duration_minutes: number | null
        internal_user: { id: string; name: string } | null
        responsible_user: { id: string; name: string } | null
        provider: { id: string; name: string } | null
        ticket: { id: string; title: string; unit_id: string } | null
      }>

      return rows
        .filter((r) => !activeUnitId || r.ticket?.unit_id === activeUnitId)
        .map((r) => ({
          id: r.id,
          ticket_id: r.ticket_id,
          ticket_title: r.ticket?.title ?? 'Chamado',
          executor_type: r.executor_type,
          status: r.status,
          scheduled_at: r.scheduled_at,
          estimated_duration_minutes: r.estimated_duration_minutes,
          internal_user: r.internal_user,
          responsible_user: r.responsible_user,
          provider: r.provider,
        })) satisfies ScheduledExecution[]
    },
  })
}
