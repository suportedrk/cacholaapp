'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'
import { useAuth } from '@/hooks/use-auth'
import { VENDAS_MODULE_ROLES } from '@/config/roles'

// ── Types ─────────────────────────────────────────────────────

export interface PhoneEntry {
  PhoneTypeId?:   number
  PhoneTypeName?: string
  PhoneNumber?:   string
}

export interface UpsellOpportunity {
  event_id:                 string
  event_date:               string
  event_title:              string
  deal_id:                  number
  unit_id:                  string
  contact_id:               string
  ploomes_contact_id:       number
  contact_name:             string
  contact_email:            string
  contact_phones:           PhoneEntry[] | null
  contact_birthday:         string | null
  contact_next_anniversary: string | null
  contact_prev_anniversary: string | null
  contact_owner_id:         number | null
  contact_owner_name:       string | null
  is_carteira_livre:        boolean
  tem_adicional:            boolean
  tem_upgrade:              boolean
  missing_categories:       string[]
  log_id:                   string | null
  log_outcome:              string | null
  log_contacted_at:         string | null
  log_notes:                string | null
}

export interface UpsellCount {
  my_count:             number
  carteira_livre_count: number
  total:                number
}

export interface UpsellPopularAddon {
  product_name: string
  category:     string
  cnt:          number
}

export type UpsellSource  = 'mine' | 'carteira_livre' | 'all'
export type UpsellOutcome = 'tentou' | 'recusou' | 'vendeu_adicional' | 'vendeu_upgrade' | 'outro'

// ── Shared retry ──────────────────────────────────────────────

function upsellRetry(count: number, err: unknown): boolean {
  const status = (err as { status?: number })?.status
  return count < 3 && status !== 401 && status !== 403
}

// ── Hooks ─────────────────────────────────────────────────────

export function useUpsellOpportunities(params: {
  sellerId:     string | null
  showContacted: boolean
  source:       UpsellSource
}) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const { sellerId, showContacted, source } = params

  return useQuery({
    queryKey:    ['upsell-opportunities', sellerId, showContacted, source],
    enabled:     isSessionReady,
    staleTime:   3 * 60 * 1000,
    networkMode: 'always',
    retry:       upsellRetry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_upsell_opportunities', {
        p_seller_id:      sellerId,
        p_show_contacted: showContacted,
        p_source:         source,
      })
      if (error) throw error
      return (data ?? []) as UpsellOpportunity[]
    },
  })
}

export function useUpsellCount() {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const { profile }    = useAuth()
  const hasAccess      = VENDAS_MODULE_ROLES.includes((profile?.role ?? '') as typeof VENDAS_MODULE_ROLES[number])

  return useQuery({
    queryKey:    ['upsell-count'],
    enabled:     isSessionReady && hasAccess,
    staleTime:   3 * 60 * 1000,
    networkMode: 'always',
    retry:       upsellRetry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_upsell_count_for_user')
      if (error) throw error
      const rows = (data ?? []) as UpsellCount[]
      return rows[0] ?? { my_count: 0, carteira_livre_count: 0, total: 0 }
    },
  })
}

export function useUpsellPopularAddons(packageName: string | null) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey:    ['upsell-popular-addons', packageName],
    enabled:     isSessionReady && !!packageName,
    staleTime:   30 * 60 * 1000,
    networkMode: 'always',
    retry:       upsellRetry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_upsell_popular_addons', {
        p_package_name: packageName,
      })
      if (error) throw error
      return (data ?? []) as UpsellPopularAddon[]
    },
  })
}

export function useLogUpsellContact() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      event_id:                    string
      seller_id:                   string
      contacted_by:                string
      outcome:                     UpsellOutcome
      notes?:                      string | null
      captured_from_carteira_livre: boolean
    }) => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('upsell_contact_log').insert(payload)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['upsell-opportunities'] })
      qc.invalidateQueries({ queryKey: ['upsell-count'] })
    },
  })
}

export function useReopenUpsellContact() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (logId: string) => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('upsell_contact_log')
        .update({ reopened_at: new Date().toISOString() })
        .eq('id', logId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['upsell-opportunities'] })
      qc.invalidateQueries({ queryKey: ['upsell-count'] })
    },
  })
}
