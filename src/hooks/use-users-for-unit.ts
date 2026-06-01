'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'

export interface RequesterOption {
  id: string
  name: string
  role: string
}

/**
 * Lista usuários ativos elegíveis como "solicitante" na abertura de chamado.
 *
 * Usa o RPC SECURITY DEFINER get_maintenance_requester_options porque a RLS de
 * users/user_units só deixa o técnico (sem usuarios.view) enxergar a si mesmo.
 * O RPC reimpõe o controle: guard check_permission('manutencao','create') +
 * escopo por unidade do CHAMADOR (is_global_viewer / get_user_unit_ids).
 *
 * @param unitId Unidade do chamado (null = unidades acessíveis do chamador).
 */
export function useActiveUsersForUnit(unitId: string | null | undefined) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['maintenance-requester-options', unitId ?? null],
    enabled: isSessionReady,
    staleTime: 5 * 60 * 1000,
    retry: (count, err: unknown) => {
      const status = (err as { status?: number })?.status
      return count < 3 && status !== 401 && status !== 403
    },
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_maintenance_requester_options', {
        p_unit_id: unitId ?? undefined,
      })
      if (error) throw error
      return (data ?? []) as RequesterOption[]
    },
  })
}
