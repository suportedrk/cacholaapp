'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'

export interface ExecutorOption {
  id: string
  name: string
  role: string
}

/**
 * Lista a EQUIPE DE MANUTENÇÃO apta a executar um chamado (executor interno).
 *
 * Usa o RPC SECURITY DEFINER get_maintenance_executor_options: a RLS de
 * users/user_units só deixa o técnico ver a si mesmo. O RPC reimpõe o controle:
 * guard check_permission('manutencao','edit') + escopo por unidade do CHAMADOR +
 * filtra só quem tem check_permission(view) no módulo (a equipe de manutenção).
 *
 * @param unitId Unidade do chamado (null = unidades acessíveis do chamador).
 */
export function useMaintenanceExecutorOptions(unitId: string | null | undefined) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['maintenance-executor-options', unitId ?? null],
    enabled: isSessionReady,
    staleTime: 5 * 60 * 1000,
    retry: (count, err: unknown) => {
      const status = (err as { status?: number })?.status
      return count < 3 && status !== 401 && status !== 403
    },
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_maintenance_executor_options', {
        p_unit_id: unitId ?? undefined,
      })
      if (error) throw error
      return (data ?? []) as ExecutorOption[]
    },
  })
}
