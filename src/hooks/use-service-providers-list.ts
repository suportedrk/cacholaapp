'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'

export type ProviderListItem = {
  id:   string
  name: string
}

/**
 * Hook simples para popular selects de prestadores no formulário de chamado.
 * Retorna apenas id + name dos prestadores ativos da unidade.
 */
export function useServiceProvidersList() {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery<ProviderListItem[]>({
    queryKey: ['service-providers-list', activeUnitId],
    enabled: isSessionReady,
    staleTime: 5 * 60 * 1000,
    retry: (count, err: unknown) => {
      const status = (err as { status?: number })?.status
      return count < 3 && status !== 401 && status !== 403
    },
    queryFn: async () => {
      const supabase = createClient()
      let q = supabase
        .from('service_providers')
        .select('id, name')
        .eq('status', 'active')
        .order('name')

      if (activeUnitId) q = q.eq('unit_id', activeUnitId)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as ProviderListItem[]
    },
  })
}
