'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'
import { useAuth } from '@/hooks/use-auth'

export interface PloomesStage {
  stage_id:   number
  stage_name: string
}

export function usePloomeStages() {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const { session } = useAuth()

  return useQuery({
    queryKey: ['ploomes-stages'],
    enabled:  !!session && isSessionReady,
    networkMode: 'always',
    staleTime: 5 * 60 * 1000, // stages mudam raramente — cache 5 min
    retry: (count, err: unknown) => {
      const e = err as { status?: number }
      return count < 3 && e?.status !== 401 && e?.status !== 403
    },
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_ploomes_stages')
      if (error) throw error
      return (data ?? []) as PloomesStage[]
    },
  })
}
