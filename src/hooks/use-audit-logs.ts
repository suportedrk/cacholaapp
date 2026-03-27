'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUnitStore } from '@/stores/unit-store'
import type { AuditLogWithUser, AuditLogFilters } from '@/types/database.types'

const PAGE_SIZE = 100

export function useAuditLogs(filters: AuditLogFilters = {}) {
  const { activeUnitId } = useUnitStore()

  return useInfiniteQuery({
    queryKey: ['audit-logs', activeUnitId, filters],
    queryFn: async ({ pageParam }) => {
      const supabase = createClient()

      // Cursor-based: busca registros com created_at < cursor (ordem DESC)
      // Primeiro filtro por unidade ativa (null = todas as unidades)
      let q = supabase
        .from('audit_logs')
        .select('*, user:users(name, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)

      if (activeUnitId) q = q.eq('unit_id', activeUnitId)
      if (pageParam)    q = q.lt('created_at', pageParam as string)
      if (filters.dateFrom) q = q.gte('created_at', filters.dateFrom)
      if (filters.dateTo)   q = q.lte('created_at', `${filters.dateTo}T23:59:59.999Z`)
      if (filters.userId)   q = q.eq('user_id', filters.userId)
      if (filters.module)   q = q.eq('module', filters.module)
      if (filters.action)   q = q.eq('action', filters.action)

      const { data, error } = await q
      if (error) throw error
      // Relationships[] está vazio em database.types.ts → cast via unknown
      return (data ?? []) as unknown as AuditLogWithUser[]
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.length < PAGE_SIZE) return undefined
      return lastPage[lastPage.length - 1].created_at
    },
    initialPageParam: undefined as string | undefined,
  })
}
