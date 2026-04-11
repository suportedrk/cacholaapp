'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'
import type {
  MaintenanceTicket,
  MaintenanceTicketForList,
  MaintenanceTicketWithDetails,
  TicketNature,
  TicketUrgency,
  TicketStatus,
  ExecutionStatus,
} from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// SELECT FRAGMENTS
// ─────────────────────────────────────────────────────────────
const TICKET_LIST_SELECT = `
  *,
  sector:maintenance_sectors!sector_id(id, name),
  category:maintenance_categories!category_id(id, name, color, icon),
  executions:maintenance_executions!ticket_id(id)
` as const

const TICKET_DETAIL_SELECT = `
  *,
  sector:maintenance_sectors!sector_id(id, name),
  category:maintenance_categories!category_id(id, name, color, icon),
  item:maintenance_items!item_id(id, name),
  equipment:equipment!equipment_id(id, name, category),
  executions:maintenance_executions!ticket_id(
    *,
    internal_user:users!internal_user_id(id, name, avatar_url),
    provider:service_providers!provider_id(id, name)
  ),
  photos:maintenance_ticket_photos!ticket_id(*),
  history:maintenance_status_history!ticket_id(
    *,
    changed_by_user:users!changed_by(name)
  )
` as const

// ─────────────────────────────────────────────────────────────
// FILTROS
// ─────────────────────────────────────────────────────────────
export type TicketFilters = {
  status?:    TicketStatus[]
  nature?:    TicketNature[]
  urgency?:   TicketUrgency[]
  sectorId?:  string
  search?:    string
  pageSize?:  number
}

// ─────────────────────────────────────────────────────────────
// LISTAR TICKETS
// ─────────────────────────────────────────────────────────────
export function useTickets(filters: TicketFilters = {}) {
  const { search, status, nature, urgency, sectorId, pageSize = 500 } = filters
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['tickets', filters, activeUnitId],
    enabled: isSessionReady,
    staleTime: 1 * 60 * 1000, // 1 min — chamados são dados dinâmicos
    networkMode: 'always',
    retry: (count, err: unknown) => {
      const status = (err as { status?: number })?.status
      return count < 3 && status !== 401 && status !== 403
    },
    queryFn: async () => {
      const supabase = createClient()

      let q = supabase
        .from('maintenance_tickets')
        .select(TICKET_LIST_SELECT)
        .order('created_at', { ascending: false })
        .limit(pageSize)

      if (activeUnitId) q = q.eq('unit_id', activeUnitId)

      if (search?.trim()) {
        q = q.or(`title.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%`)
      }
      if (status?.length)   q = q.in('status', status)
      if (nature?.length)   q = q.in('nature', nature)
      if (urgency?.length)  q = q.in('urgency', urgency)
      if (sectorId)         q = q.eq('sector_id', sectorId)

      const { data, error } = await q
      if (error) throw error

      // Sort: urgency (critical first), then created_at desc
      const URGENCY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

      return ((data ?? []) as unknown as MaintenanceTicketForList[]).sort((a, b) => {
        const urgDiff = (URGENCY_ORDER[a.urgency] ?? 4) - (URGENCY_ORDER[b.urgency] ?? 4)
        if (urgDiff !== 0) return urgDiff
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    },
  })
}

// ─────────────────────────────────────────────────────────────
// DETALHE DE UM TICKET
// ─────────────────────────────────────────────────────────────
export function useTicket(id: string | null) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['ticket', id],
    enabled: !!id && isSessionReady,
    staleTime: 30 * 1000,
    networkMode: 'always',
    retry: (count, err: unknown) => {
      const status = (err as { status?: number })?.status
      return count < 3 && status !== 401 && status !== 403
    },
    queryFn: async () => {
      if (!id) return null
      const supabase = createClient()
      const { data, error } = await supabase
        .from('maintenance_tickets')
        .select(TICKET_DETAIL_SELECT)
        .eq('id', id)
        .single()
      if (error) throw error
      return data as unknown as MaintenanceTicketWithDetails
    },
  })
}

// ─────────────────────────────────────────────────────────────
// CRIAR TICKET
// ─────────────────────────────────────────────────────────────
export type TicketInsert = Pick<
  MaintenanceTicket,
  'title' | 'nature' | 'urgency'
> & {
  description?:    string | null
  sector_id?:      string | null
  category_id?:    string | null
  item_id?:        string | null
  equipment_id?:   string | null
  scheduled_date?: string | null
  due_at?:         string | null
}

export function useCreateTicket(onSuccess?: (ticket: MaintenanceTicket) => void) {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async (payload: TicketInsert) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')

      const { data, error } = await supabase
        .from('maintenance_tickets')
        .insert({
          ...payload,
          unit_id:   activeUnitId ?? undefined,
          opened_by: user.id,
        })
        .select()
        .single()

      if (error) throw error
      return data as MaintenanceTicket
    },
    onSuccess: (ticket) => {
      qc.invalidateQueries({ queryKey: ['tickets'] })
      toast.success('Chamado aberto com sucesso')
      onSuccess?.(ticket)
    },
    onError: () => toast.error('Erro ao abrir chamado'),
  })
}

// ─────────────────────────────────────────────────────────────
// ATUALIZAR STATUS DO TICKET
// ─────────────────────────────────────────────────────────────
export function useUpdateTicketStatus() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: TicketStatus; note?: string }) => {
      const supabase = createClient()
      const patch: Partial<MaintenanceTicket> = { status }
      if (status === 'concluded') {
        patch.concluded_at = new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('maintenance_tickets')
        .update(patch)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      // Se há nota, atualizar o último registro de histórico inserido pelo trigger
      if (note?.trim()) {
        await supabase
          .from('maintenance_status_history')
          .update({ note: note.trim() })
          .eq('ticket_id', id)
          .eq('to_status', status)
          .order('created_at', { ascending: false })
          .limit(1)
      }

      return data as MaintenanceTicket
    },
    onSuccess: (ticket) => {
      qc.invalidateQueries({ queryKey: ['tickets'] })
      qc.invalidateQueries({ queryKey: ['ticket', ticket.id] })
    },
    onError: () => toast.error('Erro ao atualizar status'),
  })
}

// ─────────────────────────────────────────────────────────────
// ATUALIZAR EQUIPAMENTO DO TICKET
// ─────────────────────────────────────────────────────────────
export function useUpdateTicketEquipment() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, equipmentId }: { id: string; equipmentId: string | null }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('maintenance_tickets')
        .update({ equipment_id: equipmentId })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['ticket', id] })
      toast.success('Equipamento atualizado')
    },
    onError: () => toast.error('Erro ao atualizar equipamento'),
  })
}

// ─────────────────────────────────────────────────────────────
// ADICIONAR EXECUÇÃO
// ─────────────────────────────────────────────────────────────
export type ExecutionInsert = {
  ticket_id:        string
  executor_type:    'internal' | 'external'
  internal_user_id?: string | null
  provider_id?:     string | null
  description?:     string | null
  cost?:            number
  status?:          ExecutionStatus
}

export function useAddExecution(onSuccess?: () => void) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: ExecutionInsert) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('maintenance_executions')
        .insert({
          ...payload,
          cost: payload.cost ?? 0,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['ticket', vars.ticket_id] })
      qc.invalidateQueries({ queryKey: ['tickets'] })
      toast.success('Execução registrada')
      onSuccess?.()
    },
    onError: () => toast.error('Erro ao registrar execução'),
  })
}

// ─────────────────────────────────────────────────────────────
// ATUALIZAR EXECUÇÃO
// ─────────────────────────────────────────────────────────────
export function useUpdateExecution(ticketId: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<{ id: string; status: ExecutionStatus; cost: number; description: string }> & { id: string }) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('maintenance_executions')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', ticketId] })
      qc.invalidateQueries({ queryKey: ['tickets'] })
    },
    onError: () => toast.error('Erro ao atualizar execução'),
  })
}

// ─────────────────────────────────────────────────────────────
// UPLOAD DE FOTO DO TICKET
// ─────────────────────────────────────────────────────────────
export function useUploadTicketPhoto() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      file,
      ticketId,
      unitId,
      caption,
    }: {
      file: File
      ticketId: string
      unitId: string
      caption?: string
    }) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')

      // Importar compressImage dinamicamente (evita SSR)
      const { compressImage } = await import('@/components/shared/photo-upload')
      const compressed = await compressImage(file, 1200, 0.8)

      const path = `${unitId}/${ticketId}/${Date.now()}.jpg`

      const { error: uploadError } = await supabase.storage
        .from('maintenance-photos')
        .upload(path, compressed, { contentType: 'image/jpeg', upsert: false })
      if (uploadError) throw uploadError

      const { error: insertError } = await supabase
        .from('maintenance_ticket_photos')
        .insert({ ticket_id: ticketId, url: path, caption: caption ?? null, uploaded_by: user.id })
      if (insertError) throw insertError

      return path
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['ticket', vars.ticketId] })
      toast.success('Foto adicionada')
    },
    onError: () => toast.error('Erro ao adicionar foto'),
  })
}

// ─────────────────────────────────────────────────────────────
// APROVAR CUSTO DE EXECUÇÃO
// ─────────────────────────────────────────────────────────────
export function useApproveCost(ticketId: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (executionId: string) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')

      const { error } = await supabase
        .from('maintenance_executions')
        .update({
          cost_approved: true,
          cost_approved_by: user.id,
          cost_approved_at: new Date().toISOString(),
        })
        .eq('id', executionId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', ticketId] })
      toast.success('Custo aprovado')
    },
    onError: () => toast.error('Erro ao aprovar custo'),
  })
}
