'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'

// ── Types ──────────────────────────────────────────────────────

export interface EventSalesDeal {
  ploomes_deal_id:    number
  owner_name:         string | null
  deal_amount:        number | null
  stage_name:         string | null
  status_id:          number
  ploomes_last_update: string | null
}

export interface EventSalesProduct {
  group_name:   string | null
  product_name: string | null
  quantity:     number
  total:        number
}

export interface EventSalesContact {
  id:                string
  contacted_at:      string
  outcome:           string
  notes:             string | null
  contacted_by_name: string
  seller_name:       string | null
  reopened_at:       string | null
}

export interface EventSalesSummary {
  deal:            EventSalesDeal | null
  products:        EventSalesProduct[]
  upsell_contacts: EventSalesContact[]
}

// ── Hook ───────────────────────────────────────────────────────

export function useEventSalesSummary(eventId: string | undefined, isOpen: boolean) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['event-sales', eventId],
    enabled:  isOpen && isSessionReady && !!eventId,
    staleTime: 2 * 60 * 1000,
    retry: (count, err) => count < 2 && (err as { status?: number })?.status !== 403,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_event_sales_summary', {
        p_event_id: eventId,
      })
      if (error) throw error
      return data as EventSalesSummary
    },
  })
}
