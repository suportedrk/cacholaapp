'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'

// ── Types ─────────────────────────────────────────────────────

export type SellerEventRow = {
  id: string
  title: string
  date: string
  start_time: string
  end_time: string
  client_name: string | null
  birthday_person: string | null
  birthday_age: number | null
  status: string
}

// ── Hook ──────────────────────────────────────────────────────

export function useBISellerEvents(ownerName: string | null, unitId: string | null) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['bi', 'seller-events', ownerName, unitId],
    enabled: isSessionReady && !!ownerName,
    staleTime: 5 * 60 * 1000,
    retry: (count, err: { status?: number } | null) =>
      count < 3 && err?.status !== 401 && err?.status !== 403,
    queryFn: async (): Promise<SellerEventRow[]> => {
      const supabase = createClient()

      let query = supabase
        .from('events')
        .select('id, title, date, start_time, end_time, client_name, birthday_person, birthday_age, status')
        .eq('owner_name', ownerName!)
        .eq('status', 'confirmed')
        .order('date', { ascending: false })
        .limit(100)

      if (unitId) {
        query = query.eq('unit_id', unitId)
      }

      const { data, error } = await query
      if (error) throw { status: (error as { code?: string }).code, message: error.message }

      return (data ?? []) as SellerEventRow[]
    },
  })
}
