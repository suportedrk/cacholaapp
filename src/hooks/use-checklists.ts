'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { differenceInDays, addDays, parseISO } from 'date-fns'
import type {
  ChecklistForList, ChecklistWithItems,
  ChecklistItemStatus, ChecklistStatus, ChecklistType, Priority,
  TemplateWithItems,
} from '@/types/database.types'
import {
  notifyChecklistAssigned,
  notifyChecklistCompleted,
  notifyChecklistItemAssigned,
} from '@/lib/notifications'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'

// ─────────────────────────────────────────────────────────────
// SELECT CONSTANTS
// ─────────────────────────────────────────────────────────────

const CHECKLIST_LIST_SELECT = `
  *,
  assigned_user:users!checklists_assigned_to_fkey(id, name, avatar_url),
  created_by_user:users!checklists_created_by_fkey(id, name, avatar_url),
  completed_by_user:users!checklists_completed_by_fkey(id, name, avatar_url),
  event:events!checklists_event_id_fkey(id, title, date),
  template:checklist_templates!checklists_template_id_fkey(id, title, category_id),
  checklist_items(id, status, priority)
` as const

const CHECKLIST_DETAIL_SELECT = `
  *,
  assigned_user:users!checklists_assigned_to_fkey(id, name, avatar_url),
  created_by_user:users!checklists_created_by_fkey(id, name, avatar_url),
  completed_by_user:users!checklists_completed_by_fkey(id, name, avatar_url),
  event:events!checklists_event_id_fkey(id, title, date, start_time, end_time, status),
  template:checklist_templates!checklists_template_id_fkey(id, title),
  recurrence:checklist_recurrence!checklists_recurrence_id_fkey(id, frequency, day_of_week, is_active, next_generation_at),
  checklist_items(
    *,
    assigned_user:users!checklist_items_assigned_to_fkey(id, name, avatar_url),
    done_by_user:users!checklist_items_done_by_fkey(id, name, avatar_url)
  )
` as const

// ─────────────────────────────────────────────────────────────
// FILTROS DA LISTA — EXPANDIDOS
// ─────────────────────────────────────────────────────────────
export type ChecklistFilters = {
  eventId?: string
  assignedTo?: string
  status?: ChecklistStatus[]
  categoryId?: string
  type?: ChecklistType
  priority?: Priority
  overdue?: boolean         // due_date < now() e status pendente
  search?: string
  page?: number
  pageSize?: number
}

const RETRY = (failureCount: number, error: unknown) => {
  const status = (error as { status?: number })?.status
  if (status === 401 || status === 403) return false
  return failureCount < 2
}

// ─────────────────────────────────────────────────────────────
// LISTA DE CHECKLISTS
// ─────────────────────────────────────────────────────────────
export function useChecklists(filters: ChecklistFilters = {}) {
  const {
    eventId, assignedTo, status, categoryId,
    type, priority, overdue, search,
    page = 1, pageSize = 20,
  } = filters
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['checklists', activeUnitId, filters],
    enabled: isSessionReady,
    retry: RETRY,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const supabase = createClient()

      let query = supabase
        .from('checklists')
        .select(CHECKLIST_LIST_SELECT, { count: 'exact' })
        .order('priority', { ascending: false })
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (activeUnitId) query = query.eq('unit_id', activeUnitId)
      if (eventId)      query = query.eq('event_id', eventId)
      if (assignedTo)   query = query.eq('assigned_to', assignedTo)
      if (status?.length) query = query.in('status', status)
      if (type)         query = query.eq('type', type)
      if (priority)     query = query.eq('priority', priority)
      if (search)       query = query.ilike('title', `%${search}%`)
      if (overdue)      query = query.lt('due_date', new Date().toISOString()).in('status', ['pending', 'in_progress'])

      if (categoryId) {
        const { data: tpls } = await supabase
          .from('checklist_templates')
          .select('id')
          .eq('category_id', categoryId)
        if (tpls?.length) {
          query = query.in('template_id', tpls.map((t) => t.id))
        } else {
          return { checklists: [], total: 0, page, pageSize, totalPages: 0 }
        }
      }

      const from = (page - 1) * pageSize
      query = query.range(from, from + pageSize - 1)

      const { data, error, count } = await query
      if (error) throw error

      return {
        checklists: (data ?? []) as unknown as ChecklistForList[],
        total: count ?? 0,
        page,
        pageSize,
        totalPages: Math.ceil((count ?? 0) / pageSize),
      }
    },
  })
}

// ─────────────────────────────────────────────────────────────
// DETALHE DO CHECKLIST
// ─────────────────────────────────────────────────────────────
export function useChecklist(id: string | null) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['checklist', id],
    enabled: !!id && isSessionReady,
    retry: RETRY,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('checklists')
        .select(CHECKLIST_DETAIL_SELECT)
        .eq('id', id!)
        .single()

      if (error) throw error
      const cl = data as unknown as ChecklistWithItems
      cl.checklist_items = cl.checklist_items.sort((a, b) => a.sort_order - b.sort_order)
      return cl
    },
  })
}

// ─────────────────────────────────────────────────────────────
// ITEMS DE UM CHECKLIST (invalidação granular)
// ─────────────────────────────────────────────────────────────
export function useChecklistItems(checklistId: string | null) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['checklist-items', checklistId],
    enabled: !!checklistId && isSessionReady,
    retry: RETRY,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('checklist_items')
        .select(`
          *,
          assigned_user:users!checklist_items_assigned_to_fkey(id, name, avatar_url),
          done_by_user:users!checklist_items_done_by_fkey(id, name, avatar_url)
        `)
        .eq('checklist_id', checklistId!)
        .order('sort_order', { ascending: true })

      if (error) throw error
      return data ?? []
    },
  })
}

// ─────────────────────────────────────────────────────────────
// CHECKLISTS DE UM EVENTO
// ─────────────────────────────────────────────────────────────
export function useEventChecklists(eventId: string | null) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['checklists', 'event', eventId],
    enabled: !!eventId && isSessionReady,
    retry: RETRY,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('checklists')
        .select(`
          *,
          assigned_user:users!checklists_assigned_to_fkey(id, name, avatar_url),
          checklist_items(id, status, priority)
        `)
        .eq('event_id', eventId!)
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data ?? []) as unknown as ChecklistForList[]
    },
  })
}

// ─────────────────────────────────────────────────────────────
// CRIAR CHECKLIST — expandido para suportar todos os tipos
// ─────────────────────────────────────────────────────────────
export function useCreateChecklist() {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async ({
      templateId,
      eventId,
      title,
      type = 'event',
      description,
      priority = 'medium',
      assignedTo,
      dueDate,
      createdBy,
    }: {
      templateId?: string
      eventId?: string
      title: string
      type?: ChecklistType
      description?: string
      priority?: Priority
      assignedTo?: string
      dueDate?: string
      createdBy?: string
    }) => {
      const supabase = createClient()

      const { data: cl, error: clErr } = await supabase
        .from('checklists')
        .insert({
          title,
          type,
          description: description ?? null,
          priority,
          template_id: templateId ?? null,
          event_id: eventId ?? null,
          assigned_to: assignedTo ?? null,
          due_date: dueDate ?? null,
          created_by: createdBy ?? null,
          status: 'pending' as ChecklistStatus,
          unit_id: activeUnitId!,
        })
        .select('id')
        .single()

      if (clErr) throw clErr

      // Copiar itens do template (se fornecido), herdando campos premium
      if (templateId) {
        const { data: tplItems, error: tplErr } = await supabase
          .from('template_items')
          .select('*')
          .eq('template_id', templateId)
          .order('sort_order', { ascending: true })

        if (tplErr) throw tplErr

        if (tplItems?.length) {
          const items = tplItems.map((ti) => ({
            checklist_id: cl.id,
            description: ti.description,
            sort_order: ti.sort_order,
            status: 'pending' as ChecklistItemStatus,
            is_done: false,
            priority: ti.default_priority ?? 'medium',
            estimated_minutes: ti.default_estimated_minutes ?? null,
            notes: ti.notes_template ?? null,
            is_required: ti.is_required ?? false,
          }))
          const { error: itemsErr } = await supabase.from('checklist_items').insert(items)
          if (itemsErr) throw itemsErr
        }
      }

      return cl.id
    },
    onSuccess: (checklistId) => {
      qc.invalidateQueries({ queryKey: ['checklists'] })
      toast.success('Checklist criado com sucesso!')
      ;(async () => {
        try {
          const sb = createClient()
          const { data: { user } } = await sb.auth.getUser()
          await notifyChecklistAssigned(sb as any, checklistId, user?.id)
        } catch { /* não-crítico */ }
      })()
    },
    onError: () => toast.error('Erro ao criar checklist.'),
  })
}

// ─────────────────────────────────────────────────────────────
// ATUALIZAR CHECKLIST
// ─────────────────────────────────────────────────────────────
export function useUpdateChecklist() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: {
      id: string
      title?: string
      description?: string
      type?: ChecklistType
      priority?: Priority
      assignedTo?: string | null
      dueDate?: string | null
      completedAt?: string | null
      completedBy?: string | null
    }) => {
      const supabase = createClient()
      const update: Record<string, unknown> = {}
      if (patch.title !== undefined)       update.title = patch.title
      if (patch.description !== undefined) update.description = patch.description
      if (patch.type !== undefined)        update.type = patch.type
      if (patch.priority !== undefined)    update.priority = patch.priority
      if (patch.assignedTo !== undefined)  update.assigned_to = patch.assignedTo
      if (patch.dueDate !== undefined)     update.due_date = patch.dueDate
      if (patch.completedAt !== undefined) update.completed_at = patch.completedAt
      if (patch.completedBy !== undefined) update.completed_by = patch.completedBy

      const { error } = await supabase.from('checklists').update(update).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['checklists'] })
      qc.invalidateQueries({ queryKey: ['checklist', id] })
      toast.success('Checklist atualizado.')
    },
    onError: () => toast.error('Erro ao atualizar checklist.'),
  })
}

// ─────────────────────────────────────────────────────────────
// ATUALIZAR STATUS DO CHECKLIST
// ─────────────────────────────────────────────────────────────
export function useUpdateChecklistStatus() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ChecklistStatus }) => {
      const supabase = createClient()
      const { error } = await supabase.from('checklists').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, { id, status }) => {
      qc.invalidateQueries({ queryKey: ['checklists'] })
      qc.invalidateQueries({ queryKey: ['checklist', id] })
      toast.success('Status atualizado.')
      if (status === 'completed') {
        ;(async () => {
          try {
            const sb = createClient()
            const { data: { user } } = await sb.auth.getUser()
            await notifyChecklistCompleted(sb as any, id, user?.id)
          } catch { /* não-crítico */ }
        })()
      }
    },
    onError: () => toast.error('Erro ao atualizar status.'),
  })
}

// ─────────────────────────────────────────────────────────────
// CONCLUIR CHECKLIST (com validação de items obrigatórios)
// ─────────────────────────────────────────────────────────────
export function useCompleteChecklist() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      checklistId,
      userId,
    }: {
      checklistId: string
      userId: string
    }) => {
      const supabase = createClient()

      // Validar: todos os items obrigatórios devem estar done ou na
      const { data: items, error: itemsErr } = await supabase
        .from('checklist_items')
        .select('id, status, is_required')
        .eq('checklist_id', checklistId)

      if (itemsErr) throw itemsErr

      const blockers = (items ?? []).filter(
        (i) => i.is_required && i.status === 'pending'
      )
      if (blockers.length > 0) {
        throw new Error(
          `${blockers.length} item(s) obrigatório(s) ainda não foram concluídos.`
        )
      }

      const { error } = await supabase
        .from('checklists')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: userId,
        })
        .eq('id', checklistId)

      if (error) throw error
    },
    onSuccess: (_, { checklistId }) => {
      qc.invalidateQueries({ queryKey: ['checklists'] })
      qc.invalidateQueries({ queryKey: ['checklist', checklistId] })
      qc.invalidateQueries({ queryKey: ['checklist-stats'] })
      toast.success('Checklist concluído!')
      ;(async () => {
        try {
          const sb = createClient()
          const { data: { user } } = await sb.auth.getUser()
          await notifyChecklistCompleted(sb as any, checklistId, user?.id)
        } catch { /* não-crítico */ }
      })()
    },
    onError: (err: Error) => toast.error(err.message || 'Erro ao concluir checklist.'),
  })
}

// ─────────────────────────────────────────────────────────────
// DUPLICAR CHECKLIST (de evento anterior)
// ─────────────────────────────────────────────────────────────
export function useDuplicateChecklist() {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async ({
      sourceChecklistId,
      targetEventId,
      newTitle,
      newAssignedTo,
      newDueDate,
      createdBy,
      copyPriorities  = true,
      copyAssignees   = true,
      copyDeadlines   = false,
    }: {
      sourceChecklistId: string
      targetEventId?: string
      newTitle?: string
      newAssignedTo?: string
      newDueDate?: string
      createdBy?: string
      /** Preservar priority de cada item (default: true) */
      copyPriorities?: boolean
      /** Preservar assigned_to de cada item (default: true) */
      copyAssignees?: boolean
      /** Recalcular due_at dos itens com base no offset relativo ao prazo do checklist (default: false) */
      copyDeadlines?: boolean
    }) => {
      const supabase = createClient()

      // Buscar checklist original com itens
      const { data: source, error: srcErr } = await supabase
        .from('checklists')
        .select('*, checklist_items(*)')
        .eq('id', sourceChecklistId)
        .single()

      if (srcErr) throw srcErr

      const src = source as unknown as ChecklistWithItems

      // Criar o novo checklist
      const { data: newCl, error: clErr } = await supabase
        .from('checklists')
        .insert({
          title: newTitle ?? `${src.title} (cópia)`,
          type: targetEventId ? 'event' : 'standalone',
          description: src.description,
          priority: src.priority,
          template_id: src.template_id,
          event_id: targetEventId ?? null,
          assigned_to: newAssignedTo ?? src.assigned_to,
          due_date: newDueDate ?? null,
          unit_id: activeUnitId!,
          created_by: createdBy ?? null,
          duplicated_from: sourceChecklistId,
          status: 'pending' as ChecklistStatus,
        })
        .select('id')
        .single()

      if (clErr) throw clErr

      // Copiar itens — limpos (sem status/fotos anteriores), preservando config conforme opções
      if (src.checklist_items?.length) {
        const items = src.checklist_items.map((i) => {
          // Recalcular due_at via offset relativo ao prazo do checklist
          let itemDueAt: string | null = null
          if (copyDeadlines && i.due_at) {
            if (newDueDate && src.due_date) {
              const offset = differenceInDays(parseISO(i.due_at), parseISO(src.due_date))
              itemDueAt = addDays(parseISO(newDueDate), offset).toISOString()
            } else {
              itemDueAt = i.due_at
            }
          }
          return {
            checklist_id: newCl.id,
            description: i.description,
            sort_order: i.sort_order,
            status: 'pending' as ChecklistItemStatus,
            is_done: false,
            priority: copyPriorities ? i.priority : ('medium' as Priority),
            estimated_minutes: i.estimated_minutes,
            assigned_to: copyAssignees ? i.assigned_to : null,
            notes: null,
            photo_url: null,
            done_by: null,
            done_at: null,
            due_at: itemDueAt,
          }
        })
        const { error: itemsErr } = await supabase.from('checklist_items').insert(items)
        if (itemsErr) throw itemsErr
      }

      return newCl.id
    },
    onSuccess: (newId) => {
      qc.invalidateQueries({ queryKey: ['checklists'] })
      toast.success('Checklist duplicado com sucesso!')
      ;(async () => {
        try {
          const sb = createClient()
          const { data: { user } } = await sb.auth.getUser()
          await notifyChecklistAssigned(sb as any, newId, user?.id)
        } catch { /* não-crítico */ }
      })()
    },
    onError: () => toast.error('Erro ao duplicar checklist.'),
  })
}

// ─────────────────────────────────────────────────────────────
// EXCLUIR CHECKLIST
// ─────────────────────────────────────────────────────────────
export function useDeleteChecklist() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('checklists').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['checklists'] })
      toast.success('Checklist excluído.')
    },
    onError: () => toast.error('Erro ao excluir checklist.'),
  })
}

// ─────────────────────────────────────────────────────────────
// ATUALIZAR ITEM DO CHECKLIST — expandido com campos premium
// ─────────────────────────────────────────────────────────────
export function useUpdateChecklistItem() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      itemId,
      checklistId,
      status,
      notes,
      photoFile,
      userId,
      assignedTo,
      priority,
      dueAt,
      estimatedMinutes,
      actualMinutes,
    }: {
      itemId: string
      checklistId: string
      status?: ChecklistItemStatus
      notes?: string
      photoFile?: File
      userId?: string
      assignedTo?: string | null
      priority?: Priority
      dueAt?: string | null
      estimatedMinutes?: number | null
      actualMinutes?: number | null
    }) => {
      const supabase = createClient()

      let photo_url: string | undefined = undefined

      if (photoFile) {
        const ext = photoFile.name.split('.').pop()
        const path = `${userId ?? 'anon'}/${checklistId}/${itemId}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('checklist-photos')
          .upload(path, photoFile, { upsert: true })
        if (uploadErr) throw uploadErr

        const { data: urlData } = supabase.storage
          .from('checklist-photos')
          .getPublicUrl(path)
        photo_url = urlData.publicUrl
      }

      const now = new Date().toISOString()
      const isDone = status === 'done'
      const patch: Record<string, unknown> = {}

      if (status !== undefined) {
        patch.status = status
        patch.is_done = isDone
        if (isDone) {
          patch.done_by = userId ?? null
          patch.done_at = now
          if (actualMinutes !== undefined) patch.actual_minutes = actualMinutes
        } else if (status === 'pending') {
          patch.done_by = null
          patch.done_at = null
        }
      }
      if (notes !== undefined)            patch.notes = notes
      if (photo_url !== undefined)        patch.photo_url = photo_url
      if (assignedTo !== undefined)       patch.assigned_to = assignedTo
      if (priority !== undefined)         patch.priority = priority
      if (dueAt !== undefined)            patch.due_at = dueAt
      if (estimatedMinutes !== undefined) patch.estimated_minutes = estimatedMinutes
      if (actualMinutes !== undefined && status !== 'done') patch.actual_minutes = actualMinutes

      const { error } = await supabase
        .from('checklist_items')
        .update(patch)
        .eq('id', itemId)

      if (error) throw error

      // Notificar novo responsável (fire-and-forget)
      if (assignedTo) {
        ;(async () => {
          try {
            const sb = createClient()
            const { data: { user } } = await sb.auth.getUser()
            await notifyChecklistItemAssigned(sb as any, itemId, assignedTo, user?.id)
          } catch { /* não-crítico */ }
        })()
      }
    },
    onSuccess: (_, { checklistId }) => {
      qc.invalidateQueries({ queryKey: ['checklist', checklistId] })
      qc.invalidateQueries({ queryKey: ['checklist-items', checklistId] })
      qc.invalidateQueries({ queryKey: ['my-tasks'] })
    },
    onError: () => toast.error('Erro ao atualizar item.'),
  })
}

// ─────────────────────────────────────────────────────────────
// TEMPLATES — LISTAR
// ─────────────────────────────────────────────────────────────
export function useChecklistTemplates(onlyActive = true) {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['checklist-templates', onlyActive, activeUnitId],
    enabled: isSessionReady,
    retry: RETRY,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createClient()
      let query = supabase
        .from('checklist_templates')
        .select(`
          *,
          category:checklist_categories(id, name),
          template_items(*)
        `)
        .order('title', { ascending: true })

      if (activeUnitId) query = query.eq('unit_id', activeUnitId)
      if (onlyActive) query = query.eq('is_active', true)

      const { data, error } = await query
      if (error) throw error

      const result = (data ?? []) as unknown as TemplateWithItems[]
      result.forEach((t) => {
        t.template_items = t.template_items.sort((a, b) => a.sort_order - b.sort_order)
      })
      return result
    },
  })
}

// ─────────────────────────────────────────────────────────────
// TEMPLATES — DETALHE
// ─────────────────────────────────────────────────────────────
export function useChecklistTemplate(id: string | null) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['checklist-template', id],
    enabled: !!id && isSessionReady,
    retry: RETRY,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('checklist_templates')
        .select(`
          *,
          category:checklist_categories(id, name),
          template_items(*)
        `)
        .eq('id', id!)
        .single()

      if (error) throw error
      const tpl = data as unknown as TemplateWithItems
      tpl.template_items = tpl.template_items.sort((a, b) => a.sort_order - b.sort_order)
      return tpl
    },
  })
}

// ─────────────────────────────────────────────────────────────
// TEMPLATES — CRIAR (com campos premium)
// ─────────────────────────────────────────────────────────────
export function useCreateTemplate() {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async ({
      title,
      categoryId,
      createdBy,
      description,
      defaultPriority,
      estimatedDurationMinutes,
      items,
    }: {
      title: string
      categoryId: string | null
      createdBy: string
      description?: string
      defaultPriority?: Priority
      estimatedDurationMinutes?: number
      items: {
        description: string
        sort_order: number
        defaultPriority?: Priority
        defaultEstimatedMinutes?: number
        notesTemplate?: string
        requiresPhoto?: boolean
        isRequired?: boolean
      }[]
    }) => {
      const supabase = createClient()

      const { data: tpl, error: tplErr } = await supabase
        .from('checklist_templates')
        .insert({
          title,
          category: '',  // campo legado
          category_id: categoryId,
          created_by: createdBy,
          is_active: true,
          unit_id: activeUnitId!,
          description: description ?? null,
          default_priority: defaultPriority ?? 'medium',
          estimated_duration_minutes: estimatedDurationMinutes ?? null,
        })
        .select('id')
        .single()

      if (tplErr) throw tplErr

      if (items.length > 0) {
        const { error: itemsErr } = await supabase
          .from('template_items')
          .insert(items.map((it) => ({
            template_id: tpl.id,
            description: it.description,
            sort_order: it.sort_order,
            default_priority: it.defaultPriority ?? 'medium',
            default_estimated_minutes: it.defaultEstimatedMinutes ?? null,
            notes_template: it.notesTemplate ?? null,
            requires_photo: it.requiresPhoto ?? false,
            is_required: it.isRequired ?? false,
          })))
        if (itemsErr) throw itemsErr
      }

      return tpl.id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['checklist-templates'] })
      toast.success('Template criado com sucesso!')
    },
    onError: () => toast.error('Erro ao criar template.'),
  })
}

// ─────────────────────────────────────────────────────────────
// TEMPLATES — ATUALIZAR
// ─────────────────────────────────────────────────────────────
export function useUpdateTemplate() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      title,
      categoryId,
      isActive,
      description,
      defaultPriority,
      estimatedDurationMinutes,
      items,
    }: {
      id: string
      title: string
      categoryId: string | null
      isActive: boolean
      description?: string
      defaultPriority?: Priority
      estimatedDurationMinutes?: number
      items: {
        description: string
        sort_order: number
        defaultPriority?: Priority
        defaultEstimatedMinutes?: number
        notesTemplate?: string
        requiresPhoto?: boolean
        isRequired?: boolean
      }[]
    }) => {
      const supabase = createClient()

      const { error: tplErr } = await supabase
        .from('checklist_templates')
        .update({
          title,
          category_id: categoryId,
          is_active: isActive,
          description: description ?? null,
          default_priority: defaultPriority ?? 'medium',
          estimated_duration_minutes: estimatedDurationMinutes ?? null,
        })
        .eq('id', id)

      if (tplErr) throw tplErr

      await supabase.from('template_items').delete().eq('template_id', id)
      if (items.length > 0) {
        const { error: itemsErr } = await supabase
          .from('template_items')
          .insert(items.map((it) => ({
            template_id: id,
            description: it.description,
            sort_order: it.sort_order,
            default_priority: it.defaultPriority ?? 'medium',
            default_estimated_minutes: it.defaultEstimatedMinutes ?? null,
            notes_template: it.notesTemplate ?? null,
            requires_photo: it.requiresPhoto ?? false,
            is_required: it.isRequired ?? false,
          })))
        if (itemsErr) throw itemsErr
      }
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['checklist-templates'] })
      qc.invalidateQueries({ queryKey: ['checklist-template', id] })
      toast.success('Template atualizado.')
    },
    onError: () => toast.error('Erro ao atualizar template.'),
  })
}

// ─────────────────────────────────────────────────────────────
// TEMPLATES — EXCLUIR (soft delete)
// ─────────────────────────────────────────────────────────────
export function useDeleteTemplate() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('checklist_templates')
        .update({ is_active: false })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['checklist-templates'] })
      toast.success('Template desativado.')
    },
    onError: () => toast.error('Erro ao desativar template.'),
  })
}

// ─────────────────────────────────────────────────────────────
// CATEGORIAS DE CHECKLIST
// ─────────────────────────────────────────────────────────────
export function useChecklistCategories() {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['checklist-categories', activeUnitId],
    enabled: isSessionReady,
    retry: RETRY,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const supabase = createClient()
      let query = supabase
        .from('checklist_categories')
        .select('id, name, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
      if (activeUnitId) query = query.eq('unit_id', activeUnitId)
      const { data, error } = await query
      if (error) throw error
      return data ?? []
    },
  })
}

// Re-export select constants para uso externo (ex: offline hook)
export { CHECKLIST_LIST_SELECT, CHECKLIST_DETAIL_SELECT }
