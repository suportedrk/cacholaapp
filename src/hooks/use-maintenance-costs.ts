'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'
import type { MaintenanceCost, MaintenanceCostStatus, MaintenanceCostType } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
export type CostWithRelations = MaintenanceCost & {
  order:     { id: string; title: string; type: string } | null
  submitter: { id: string; name: string; avatar_url: string | null } | null
  reviewer:  { id: string; name: string; avatar_url: string | null } | null
}

export type CostFilters = {
  status?:    MaintenanceCostStatus[]
  cost_type?: MaintenanceCostType[]
  order_id?:  string
  period?:    'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'all'
}

export type CostInsert = {
  order_id:       string
  description:    string
  amount:         number
  cost_type:      MaintenanceCostType
  receipt_url?:   string | null
  receipt_notes?: string | null
}

const COST_SELECT = `
  *,
  order:maintenance_orders(id, title, type),
  submitter:users!submitted_by(id, name, avatar_url),
  reviewer:users!reviewed_by(id, name, avatar_url)
` as const

function getPeriodRange(period: CostFilters['period']) {
  const now = new Date()
  switch (period) {
    case 'this_month':    return { from: startOfMonth(now).toISOString(), to: endOfMonth(now).toISOString() }
    case 'last_month':    return { from: startOfMonth(subMonths(now, 1)).toISOString(), to: endOfMonth(subMonths(now, 1)).toISOString() }
    case 'last_3_months': return { from: startOfMonth(subMonths(now, 2)).toISOString(), to: endOfMonth(now).toISOString() }
    case 'this_year':     return { from: startOfYear(now).toISOString(), to: endOfYear(now).toISOString() }
    default:              return null
  }
}

function sortCosts(costs: CostWithRelations[]) {
  return costs.sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1
    if (a.status !== 'pending' && b.status === 'pending') return 1
    return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
  })
}

// ─────────────────────────────────────────────────────────────
// LIST (costs tab)
// ─────────────────────────────────────────────────────────────
export function useMaintCosts(filters: CostFilters = {}) {
  const { activeUnitId } = useUnitStore()
  const isSessionReady   = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['maintenance-costs', activeUnitId, filters],
    enabled:  !!activeUnitId && isSessionReady,
    staleTime: 30 * 1000,
    retry: (failureCount, error: unknown) => {
      const status = (error as { status?: number })?.status
      if (status === 401 || status === 403) return false
      return failureCount < 2
    },
    queryFn: async () => {
      const supabase = createClient()
      let q = supabase
        .from('maintenance_costs')
        .select(COST_SELECT)
        .eq('unit_id', activeUnitId!)
        .order('submitted_at', { ascending: false })

      if (filters.status?.length)    q = q.in('status', filters.status)
      if (filters.cost_type?.length) q = q.in('cost_type', filters.cost_type)
      if (filters.order_id)          q = q.eq('order_id', filters.order_id)

      const range = getPeriodRange(filters.period)
      if (range) q = q.gte('submitted_at', range.from).lte('submitted_at', range.to)

      const { data, error } = await q
      if (error) throw error
      return sortCosts(data as unknown as CostWithRelations[])
    },
  })
}

// ─────────────────────────────────────────────────────────────
// ORDER COSTS (used in order detail page)
// ─────────────────────────────────────────────────────────────
export function useOrderCosts(orderId: string | undefined) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['maintenance-costs', 'order', orderId],
    enabled:  isSessionReady && !!orderId,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('maintenance_costs')
        .select(COST_SELECT)
        .eq('order_id', orderId!)
        .order('submitted_at', { ascending: false })
      if (error) throw error
      return sortCosts(data as unknown as CostWithRelations[])
    },
  })
}

// ─────────────────────────────────────────────────────────────
// SUMMARY KPIs
// ─────────────────────────────────────────────────────────────
export function useCostsSummary() {
  const { activeUnitId } = useUnitStore()
  const isSessionReady   = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['maintenance-costs-summary', activeUnitId],
    enabled:  !!activeUnitId && isSessionReady,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const supabase = createClient()
      const now        = new Date()
      const monthStart = startOfMonth(now).toISOString()
      const monthEnd   = endOfMonth(now).toISOString()

      const [pendingResult, approvedResult, totalResult] = await Promise.all([
        supabase
          .from('maintenance_costs')
          .select('*', { count: 'exact', head: true })
          .eq('unit_id', activeUnitId!)
          .eq('status', 'pending'),
        supabase
          .from('maintenance_costs')
          .select('amount')
          .eq('unit_id', activeUnitId!)
          .eq('status', 'approved')
          .gte('submitted_at', monthStart)
          .lte('submitted_at', monthEnd),
        supabase
          .from('maintenance_costs')
          .select('amount')
          .eq('unit_id', activeUnitId!)
          .in('status', ['approved', 'pending'])
          .gte('submitted_at', monthStart)
          .lte('submitted_at', monthEnd),
      ])

      const approvedSum = (approvedResult.data ?? []).reduce((acc, r) => acc + Number(r.amount), 0)
      const totalSum    = (totalResult.data ?? []).reduce((acc, r) => acc + Number(r.amount), 0)

      return {
        pendingCount: pendingResult.count ?? 0,
        approvedSum,
        totalSum,
      }
    },
  })
}

// ─────────────────────────────────────────────────────────────
// CURRENT USER (for permission checks)
// ─────────────────────────────────────────────────────────────
export function useCurrentUser() {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['current-user-profile'],
    enabled:  isSessionReady,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data: profile } = await supabase
        .from('users')
        .select('id, name, role, avatar_url')
        .eq('id', user.id)
        .single()
      return profile as { id: string; name: string; role: string; avatar_url: string | null } | null
    },
  })
}

// ─────────────────────────────────────────────────────────────
// SUBMIT COST
// ─────────────────────────────────────────────────────────────
export function useSubmitCost() {
  const qc           = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async (payload: CostInsert) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')

      const { data, error } = await supabase
        .from('maintenance_costs')
        .insert({
          unit_id:       activeUnitId!,
          order_id:      payload.order_id,
          description:   payload.description,
          amount:        payload.amount,
          cost_type:     payload.cost_type,
          receipt_url:   payload.receipt_url ?? null,
          receipt_notes: payload.receipt_notes ?? null,
          status:        'pending',
          submitted_by:  user.id,
          submitted_at:  new Date().toISOString(),
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance-costs'] })
      qc.invalidateQueries({ queryKey: ['maintenance-costs-summary', activeUnitId] })
      qc.invalidateQueries({ queryKey: ['maintenance-stats', activeUnitId] })
      toast.success('Custo registrado e enviado para aprovação')
    },
    onError: (err: Error) => toast.error(err.message ?? 'Erro ao registrar custo'),
  })
}

// ─────────────────────────────────────────────────────────────
// APPROVE COST
// ─────────────────────────────────────────────────────────────
export function useApproveCost() {
  const qc           = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async (costId: string) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')

      const { error } = await supabase
        .from('maintenance_costs')
        .update({
          status:      'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', costId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance-costs'] })
      qc.invalidateQueries({ queryKey: ['maintenance-costs-summary', activeUnitId] })
      qc.invalidateQueries({ queryKey: ['maintenance-stats', activeUnitId] })
      toast.success('Custo aprovado')
    },
    onError: (err: Error) => toast.error(err.message ?? 'Erro ao aprovar custo'),
  })
}

// ─────────────────────────────────────────────────────────────
// REJECT COST
// ─────────────────────────────────────────────────────────────
export function useRejectCost() {
  const qc           = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async ({ costId, review_notes }: { costId: string; review_notes: string }) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')

      const { error } = await supabase
        .from('maintenance_costs')
        .update({
          status:       'rejected',
          reviewed_by:  user.id,
          reviewed_at:  new Date().toISOString(),
          review_notes,
        })
        .eq('id', costId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance-costs'] })
      qc.invalidateQueries({ queryKey: ['maintenance-costs-summary', activeUnitId] })
      qc.invalidateQueries({ queryKey: ['maintenance-stats', activeUnitId] })
      toast.success('Custo reprovado')
    },
    onError: (err: Error) => toast.error(err.message ?? 'Erro ao reprovar custo'),
  })
}

// ─────────────────────────────────────────────────────────────
// DELETE COST (cancel own pending cost)
// ─────────────────────────────────────────────────────────────
export function useDeleteCost() {
  const qc           = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async ({ costId, receiptUrl }: { costId: string; receiptUrl: string | null }) => {
      const supabase = createClient()
      if (receiptUrl) {
        await supabase.storage.from('maintenance-receipts').remove([receiptUrl]).catch(() => null)
      }
      const { error } = await supabase.from('maintenance_costs').delete().eq('id', costId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance-costs'] })
      qc.invalidateQueries({ queryKey: ['maintenance-costs-summary', activeUnitId] })
      qc.invalidateQueries({ queryKey: ['maintenance-stats', activeUnitId] })
      toast.success('Custo cancelado')
    },
    onError: (err: Error) => toast.error(err.message ?? 'Erro ao cancelar custo'),
  })
}

// ─────────────────────────────────────────────────────────────
// UPLOAD RECEIPT
// ─────────────────────────────────────────────────────────────
export function useUploadReceipt() {
  return useMutation({
    mutationFn: async ({
      file,
      onProgress,
    }: {
      file: File
      onProgress: (pct: number) => void
    }): Promise<string> => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')

      const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${user.id}/${Date.now()}_${safeFilename}`

      let pct = 0
      const interval = setInterval(() => {
        pct = Math.min(pct + 12, 85)
        onProgress(pct)
      }, 180)

      try {
        const { error } = await supabase.storage
          .from('maintenance-receipts')
          .upload(path, file, { upsert: false })
        clearInterval(interval)
        if (error) throw error
        onProgress(100)
        return path
      } catch (err) {
        clearInterval(interval)
        throw err
      }
    },
  })
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
export const COST_TYPE_LABELS: Record<MaintenanceCostType, string> = {
  material: 'Material/Peça',
  labor:    'Mão de Obra',
  travel:   'Deslocamento',
  other:    'Outro',
}

export const PERIOD_OPTIONS = [
  { value: 'this_month' as const,    label: 'Este mês' },
  { value: 'last_month' as const,    label: 'Mês passado' },
  { value: 'last_3_months' as const, label: 'Últimos 3 meses' },
  { value: 'this_year' as const,     label: 'Este ano' },
  { value: 'all' as const,           label: 'Todos' },
]

export const MANAGER_ROLES = ['super_admin', 'diretor', 'gerente'] as const

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}
