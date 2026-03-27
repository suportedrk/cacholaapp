'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { addDays, addWeeks, addMonths, format } from 'date-fns'
import type {
  MaintenanceOrder, MaintenanceWithDetails, MaintenanceForList,
  MaintenanceType, MaintenancePriority, MaintenanceStatus, RecurrenceRule,
} from '@/types/database.types'
import {
  notifyMaintenanceCreated,
  notifyMaintenanceEmergency,
  notifyMaintenanceStatusChanged,
  notifyMaintenanceCompleted,
} from '@/lib/notifications'

// ─────────────────────────────────────────────────────────────
// SELECT FRAGMENTS
// ─────────────────────────────────────────────────────────────
const MAINTENANCE_LIST_SELECT = `
  *,
  sector:sectors(id, name),
  assigned_user:users!maintenance_orders_assigned_to_fkey(id, name, avatar_url)
` as const

const MAINTENANCE_DETAIL_SELECT = `
  *,
  sector:sectors(id, name),
  assigned_user:users!maintenance_orders_assigned_to_fkey(id, name, avatar_url),
  creator:users!maintenance_orders_created_by_fkey(id, name, avatar_url),
  event:events(id, title, date),
  maintenance_photos(*)
` as const

// ─────────────────────────────────────────────────────────────
// FILTROS
// ─────────────────────────────────────────────────────────────
export type MaintenanceFilters = {
  search?:   string
  type?:     MaintenanceType[]
  status?:   MaintenanceStatus[]
  priority?: MaintenancePriority[]
  sectorId?: string
  page?:     number
  pageSize?: number
}

// ─────────────────────────────────────────────────────────────
// LISTAR ORDENS
// ─────────────────────────────────────────────────────────────
export function useMaintenanceOrders(filters: MaintenanceFilters = {}) {
  const { search, type, status, priority, sectorId, page = 1, pageSize = 12 } = filters

  return useQuery({
    queryKey: ['maintenance', filters],
    queryFn: async () => {
      const supabase = createClient()
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      let q = supabase
        .from('maintenance_orders')
        .select(MAINTENANCE_LIST_SELECT, { count: 'exact' })

      if (search?.trim()) {
        q = q.or(`title.ilike.%${search}%,description.ilike.%${search}%,equipment.ilike.%${search}%`)
      }
      if (type?.length)     q = q.in('type', type)
      if (status?.length)   q = q.in('status', status)
      if (priority?.length) q = q.in('priority', priority)
      if (sectorId)         q = q.eq('sector_id', sectorId)

      // Ordenação: emergencial primeiro, depois prioridade, depois data
      q = q
        .order('type',     { ascending: true })   // emergency < punctual < recurring (alpha)
        .order('priority', { ascending: false })   // critical first
        .order('due_date', { ascending: true, nullsFirst: false })
        .range(from, to)

      const { data, count, error } = await q
      if (error) throw error

      return {
        data: (data ?? []) as unknown as MaintenanceForList[],
        count: count ?? 0,
        page,
        pageSize,
        totalPages: Math.ceil((count ?? 0) / pageSize),
      }
    },
    staleTime: 30 * 1000,
  })
}

// ─────────────────────────────────────────────────────────────
// DETALHE DA ORDEM
// ─────────────────────────────────────────────────────────────
export function useMaintenanceOrder(id: string | null) {
  return useQuery({
    queryKey: ['maintenance', id],
    enabled: !!id,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('maintenance_orders')
        .select(MAINTENANCE_DETAIL_SELECT)
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as unknown as MaintenanceWithDetails
    },
    staleTime: 30 * 1000,
  })
}

// ─────────────────────────────────────────────────────────────
// CRIAR ORDEM
// ─────────────────────────────────────────────────────────────
export type MaintenanceOrderInsert = Omit<
  MaintenanceOrder,
  'id' | 'created_at' | 'updated_at'
>

export function useCreateMaintenanceOrder() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (orderData: MaintenanceOrderInsert) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('maintenance_orders')
        .insert(orderData as any)
        .select('id, type')
        .single()
      if (error) throw error
      return data as { id: string; type: MaintenanceType }
    },
    onSuccess: ({ id, type }) => {
      qc.invalidateQueries({ queryKey: ['maintenance'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Ordem de manutenção criada!')
      // Fire-and-forget notifications + email
      ;(async () => {
        try {
          const sb = createClient()
          const { data: { user } } = await sb.auth.getUser()
          if (type === 'emergency') {
            await notifyMaintenanceEmergency(sb as any, id, user?.id)
            // Email via server route (API key is server-side only)
            fetch('/api/email/maintenance-emergency', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderId: id }),
            }).catch(() => { /* não-crítico */ })
          } else {
            await notifyMaintenanceCreated(sb as any, id, user?.id)
          }
        } catch { /* não-crítico */ }
      })()
    },
    onError: () => toast.error('Erro ao criar ordem de manutenção.'),
  })
}

// ─────────────────────────────────────────────────────────────
// ATUALIZAR ORDEM
// ─────────────────────────────────────────────────────────────
export function useUpdateMaintenanceOrder() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MaintenanceOrderInsert> }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('maintenance_orders')
        .update(data as any)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['maintenance'] })
      qc.invalidateQueries({ queryKey: ['maintenance', id] })
      toast.success('Ordem atualizada.')
    },
    onError: () => toast.error('Erro ao atualizar ordem.'),
  })
}

// ─────────────────────────────────────────────────────────────
// MUDAR STATUS (ação rápida no detalhe)
// ─────────────────────────────────────────────────────────────
export function useChangeMaintenanceStatus() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: MaintenanceStatus }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('maintenance_orders')
        .update({ status })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, { id, status }) => {
      qc.invalidateQueries({ queryKey: ['maintenance'] })
      qc.invalidateQueries({ queryKey: ['maintenance', id] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Status atualizado.')
      ;(async () => {
        try {
          const sb = createClient()
          const { data: { user } } = await sb.auth.getUser()
          await notifyMaintenanceStatusChanged(sb as any, id, status, user?.id)
        } catch { /* não-crítico */ }
      })()
    },
    onError: () => toast.error('Erro ao atualizar status.'),
  })
}

// ─────────────────────────────────────────────────────────────
// CONCLUIR ORDEM (com lógica de recorrência)
// ─────────────────────────────────────────────────────────────
function calcNextDueDate(rule: RecurrenceRule): string {
  const base = new Date()
  let next: Date
  if (rule.frequency === 'daily') {
    next = addDays(base, rule.interval)
  } else if (rule.frequency === 'weekly') {
    next = addWeeks(base, rule.interval)
  } else {
    next = addMonths(base, rule.interval)
  }
  return format(next, 'yyyy-MM-dd')
}

export function useCompleteMaintenanceOrder() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()

      // Buscar ordem atual
      const { data: order, error: fetchErr } = await supabase
        .from('maintenance_orders')
        .select('*')
        .eq('id', id)
        .single()
      if (fetchErr) throw fetchErr

      // Marcar como concluída
      const { error: updateErr } = await supabase
        .from('maintenance_orders')
        .update({ status: 'completed' })
        .eq('id', id)
      if (updateErr) throw updateErr

      // Se recorrente: criar próxima instância
      if (order.type === 'recurring' && order.recurrence_rule) {
        const rule = order.recurrence_rule as RecurrenceRule
        const nextDate = calcNextDueDate(rule)
        const updatedRule = { ...rule, next_due_date: nextDate }
        const { error: nextErr } = await supabase
          .from('maintenance_orders')
          .insert({
            title:           order.title,
            description:     order.description,
            type:            order.type,
            priority:        order.priority,
            sector_id:       order.sector_id,
            equipment:       order.equipment,
            status:          'open',
            assigned_to:     order.assigned_to,
            due_date:        nextDate,
            event_id:        null,
            recurrence_rule: updatedRule,
            created_by:      order.created_by,
          } as any)
        if (nextErr) throw nextErr
      }

      return { id, type: order.type as MaintenanceType, created_by: order.created_by as string }
    },
    onSuccess: ({ id, created_by }) => {
      qc.invalidateQueries({ queryKey: ['maintenance'] })
      qc.invalidateQueries({ queryKey: ['maintenance', id] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Ordem concluída!')
      ;(async () => {
        try {
          const sb = createClient()
          const { data: { user } } = await sb.auth.getUser()
          await notifyMaintenanceCompleted(sb as any, id, created_by, user?.id)
        } catch { /* não-crítico */ }
      })()
    },
    onError: () => toast.error('Erro ao concluir ordem.'),
  })
}

// ─────────────────────────────────────────────────────────────
// EXCLUIR ORDEM
// ─────────────────────────────────────────────────────────────
export function useDeleteMaintenanceOrder() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('maintenance_orders').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Ordem excluída.')
    },
    onError: () => toast.error('Erro ao excluir ordem.'),
  })
}

// ─────────────────────────────────────────────────────────────
// ADICIONAR FOTO À ORDEM
// ─────────────────────────────────────────────────────────────
export function useAddMaintenancePhoto() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      orderId,
      url,
      type,
      uploadedBy,
    }: {
      orderId: string
      url: string
      type: 'before' | 'after' | 'during'
      uploadedBy: string
    }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('maintenance_photos')
        .insert({ order_id: orderId, url, type, uploaded_by: uploadedBy })
      if (error) throw error
    },
    onSuccess: (_, { orderId }) => {
      qc.invalidateQueries({ queryKey: ['maintenance', orderId] })
    },
    onError: () => toast.error('Erro ao salvar foto.'),
  })
}

// ─────────────────────────────────────────────────────────────
// REMOVER FOTO
// ─────────────────────────────────────────────────────────────
export function useRemoveMaintenancePhoto() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ photoId, orderId }: { photoId: string; orderId: string }) => {
      const supabase = createClient()
      const { error } = await supabase.from('maintenance_photos').delete().eq('id', photoId)
      if (error) throw error
      return orderId
    },
    onSuccess: (orderId) => {
      qc.invalidateQueries({ queryKey: ['maintenance', orderId] })
    },
    onError: () => toast.error('Erro ao remover foto.'),
  })
}
