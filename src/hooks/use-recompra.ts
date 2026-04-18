'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'
import { useAuth } from '@/hooks/use-auth'
import { VENDAS_MODULE_ROLES } from '@/config/roles'
import type { PhoneEntry } from '@/hooks/use-upsell'

// ── Types ─────────────────────────────────────────────────────

export type RecompraType   = 'aniversario' | 'festa_passada'
export type RecompraSource = 'mine' | 'carteira_livre' | 'all'
export type RecompraOutcome = 'tentou' | 'recusou' | 'vendeu' | 'outro'

export interface RecompraAniversarioOpp {
  deal_id:                 number
  deal_title:              string | null
  unit_id:                 string | null
  contact_id:              string | null
  ploomes_contact_id:      number | null
  contact_name:            string
  contact_email:           string
  contact_phones:          PhoneEntry[] | null
  aniversariante_birthday: string
  next_birthday:           string
  days_until_birthday:     number
  contact_owner_id:        number | null
  contact_owner_name:      string | null
  is_carteira_livre:       boolean
  log_id:                  string | null
  log_outcome:             string | null
  log_contacted_at:        string | null
  log_notes:               string | null
}

export interface RecompraFestaPassadaOpp {
  deal_id:                 number
  deal_title:              string | null
  unit_id:                 string | null
  contact_id:              string | null
  ploomes_contact_id:      number | null
  contact_name:            string
  contact_email:           string
  contact_phones:          PhoneEntry[] | null
  aniversariante_birthday: string
  last_event_date:         string
  months_since_event:      number
  contact_owner_id:        number | null
  contact_owner_name:      string | null
  is_carteira_livre:       boolean
  log_id:                  string | null
  log_outcome:             string | null
  log_contacted_at:        string | null
  log_notes:               string | null
}

export interface RecompraCount {
  aniversario_count:    number
  festa_passada_count:  number
  total:                number
}

// ── Shared retry ──────────────────────────────────────────────

function recompraRetry(count: number, err: unknown): boolean {
  const status = (err as { status?: number })?.status
  return count < 3 && status !== 401 && status !== 403
}

// ── Hooks ─────────────────────────────────────────────────────

export function useRecompraAniversario(params: {
  sellerId:      string | null
  showContacted: boolean
  source:        RecompraSource
  daysAhead?:    number
}) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const { sellerId, showContacted, source, daysAhead = 90 } = params

  return useQuery({
    queryKey:    ['recompra-aniversario', sellerId, showContacted, source, daysAhead],
    enabled:     isSessionReady,
    staleTime:   3 * 60 * 1000,
    networkMode: 'always',
    retry:       recompraRetry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_recompra_aniversario_proximo', {
        p_seller_id:      sellerId,
        p_show_contacted: showContacted,
        p_source:         source,
        p_days_ahead:     daysAhead,
      })
      if (error) throw error
      return (data ?? []) as RecompraAniversarioOpp[]
    },
  })
}

export function useRecompraFestaPassada(params: {
  sellerId:      string | null
  showContacted: boolean
  source:        RecompraSource
}) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const { sellerId, showContacted, source } = params

  return useQuery({
    queryKey:    ['recompra-festa-passada', sellerId, showContacted, source],
    enabled:     isSessionReady,
    staleTime:   3 * 60 * 1000,
    networkMode: 'always',
    retry:       recompraRetry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_recompra_festa_passada', {
        p_seller_id:      sellerId,
        p_show_contacted: showContacted,
        p_source:         source,
      })
      if (error) throw error
      return (data ?? []) as RecompraFestaPassadaOpp[]
    },
  })
}

export function useRecompraCount() {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const { profile }    = useAuth()
  const hasAccess      = VENDAS_MODULE_ROLES.includes((profile?.role ?? '') as typeof VENDAS_MODULE_ROLES[number])

  return useQuery({
    queryKey:    ['recompra-count'],
    enabled:     isSessionReady && hasAccess,
    staleTime:   3 * 60 * 1000,
    networkMode: 'always',
    retry:       recompraRetry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_recompra_count_for_user')
      if (error) throw error
      const rows = (data ?? []) as RecompraCount[]
      return rows[0] ?? { aniversario_count: 0, festa_passada_count: 0, total: 0 }
    },
  })
}

export function useLogRecompraContact() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      contact_email:                string
      aniversariante_birthday:      string
      recompra_type:                RecompraType
      seller_id:                    string
      contacted_by:                 string
      outcome:                      RecompraOutcome
      notes?:                       string | null
      captured_from_carteira_livre: boolean
    }) => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('recompra_contact_log').insert(payload)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recompra-aniversario'] })
      qc.invalidateQueries({ queryKey: ['recompra-festa-passada'] })
      qc.invalidateQueries({ queryKey: ['recompra-count'] })
    },
  })
}

export function useReopenRecompraContact() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (logId: string) => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('recompra_contact_log')
        .update({ reopened_at: new Date().toISOString() })
        .eq('id', logId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recompra-aniversario'] })
      qc.invalidateQueries({ queryKey: ['recompra-festa-passada'] })
      qc.invalidateQueries({ queryKey: ['recompra-count'] })
    },
  })
}
