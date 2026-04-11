'use client'

import { useQuery } from '@tanstack/react-query'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'
import type { MaintenanceStatsResponse } from '@/app/api/maintenance/stats/route'

export type { MaintenanceStatsResponse }

export function useMaintenanceStats() {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['maintenance-stats', activeUnitId],
    enabled: isSessionReady,
    staleTime: 2 * 60 * 1000, // 2 min
    retry: (failureCount, error: unknown) => {
      const status = (error as { status?: number })?.status
      if (status === 401 || status === 403) return false
      return failureCount < 2
    },
    queryFn: async () => {
      const params = activeUnitId ? `?unit_id=${activeUnitId}` : ''
      const res = await fetch(`/api/maintenance/stats${params}`)
      if (!res.ok) {
        const err = Object.assign(new Error('Failed to fetch stats'), { status: res.status })
        throw err
      }
      return res.json() as Promise<MaintenanceStatsResponse>
    },
  })
}
