'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useAuthReadyStore } from '@/stores/auth-store'

export interface MyMaintenanceTask {
  id: string
  ticket_id: string
  ticket_title: string
  role: 'executor' | 'responsible'  // papel do usuário nesta execução
  status: string
  scheduled_at: string
  estimated_duration_minutes: number | null
}

/**
 * Execuções agendadas onde o usuário logado é o EXECUTOR interno OU o RESPONSÁVEL
 * do serviço externo. A RLS de maintenance_executions já restringe ao escopo do
 * usuário; o filtro pessoal (eu) é aplicado client-side sobre esse conjunto.
 */
export function useMyMaintenanceTasks() {
  const { profile } = useAuth()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const myId = profile?.id ?? null

  return useQuery({
    queryKey: ['my-maintenance-tasks', myId],
    enabled: isSessionReady && !!myId,
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
          id, ticket_id, internal_user_id, responsible_user_id, status,
          scheduled_at, estimated_duration_minutes,
          ticket:maintenance_tickets!ticket_id(id, title)
        `)
        .not('scheduled_at', 'is', null)
        .order('scheduled_at', { ascending: true })

      if (error) throw error

      const rows = (data ?? []) as unknown as Array<{
        id: string; ticket_id: string; internal_user_id: string | null
        responsible_user_id: string | null; status: string; scheduled_at: string
        estimated_duration_minutes: number | null
        ticket: { id: string; title: string } | null
      }>

      return rows
        .filter((r) => r.internal_user_id === myId || r.responsible_user_id === myId)
        .map((r) => ({
          id: r.id,
          ticket_id: r.ticket_id,
          ticket_title: r.ticket?.title ?? 'Chamado',
          role: (r.internal_user_id === myId ? 'executor' : 'responsible') as 'executor' | 'responsible',
          status: r.status,
          scheduled_at: r.scheduled_at,
          estimated_duration_minutes: r.estimated_duration_minutes,
        })) satisfies MyMaintenanceTask[]
    },
  })
}
