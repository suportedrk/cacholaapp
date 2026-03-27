'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type {
  ChecklistForList, ChecklistWithItems,
  ChecklistItemStatus, ChecklistStatus,
  TemplateWithItems,
} from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// FILTROS DA LISTA
// ─────────────────────────────────────────────────────────────
export type ChecklistFilters = {
  eventId?: string
  assignedTo?: string
  status?: ChecklistStatus[]
  categoryId?: string
  page?: number
  pageSize?: number
}

// ─────────────────────────────────────────────────────────────
// LISTA DE CHECKLISTS
// ─────────────────────────────────────────────────────────────
export function useChecklists(filters: ChecklistFilters = {}) {
  const { eventId, assignedTo, status, categoryId, page = 1, pageSize = 20 } = filters

  return useQuery({
    queryKey: ['checklists', filters],
    queryFn: async () => {
      const supabase = createClient()

      let query = supabase
        .from('checklists')
        .select(`
          *,
          event:events(id, title, date),
          assigned_user:users(id, name, avatar_url),
          checklist_items(id, status)
        `, { count: 'exact' })
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (eventId)    query = query.eq('event_id', eventId)
      if (assignedTo) query = query.eq('assigned_to', assignedTo)
      if (status?.length) query = query.in('status', status)
      if (categoryId) {
        // filtra via template que tem essa categoria
        const sub = supabase
          .from('checklist_templates')
          .select('id')
          .eq('category_id', categoryId)
        const { data: tpls } = await sub
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
    staleTime: 30 * 1000,
  })
}

// ─────────────────────────────────────────────────────────────
// DETALHE DO CHECKLIST (com todos os itens)
// ─────────────────────────────────────────────────────────────
export function useChecklist(id: string | null) {
  return useQuery({
    queryKey: ['checklist', id],
    enabled: !!id,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('checklists')
        .select(`
          *,
          event:events(id, title, date),
          assigned_user:users(id, name, avatar_url),
          checklist_items(*)
        `)
        .eq('id', id!)
        .single()

      if (error) throw error
      const cl = data as unknown as ChecklistWithItems
      // Ordenar itens por sort_order
      cl.checklist_items = cl.checklist_items.sort((a, b) => a.sort_order - b.sort_order)
      return cl
    },
  })
}

// ─────────────────────────────────────────────────────────────
// CHECKLISTS DE UM EVENTO
// ─────────────────────────────────────────────────────────────
export function useEventChecklists(eventId: string | null) {
  return useQuery({
    queryKey: ['checklists', 'event', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('checklists')
        .select(`
          *,
          assigned_user:users(id, name, avatar_url),
          checklist_items(id, status)
        `)
        .eq('event_id', eventId!)
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data ?? []) as unknown as ChecklistForList[]
    },
    staleTime: 30 * 1000,
  })
}

// ─────────────────────────────────────────────────────────────
// CRIAR CHECKLIST (a partir de template)
// ─────────────────────────────────────────────────────────────
export function useCreateChecklist() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      templateId,
      eventId,
      title,
      assignedTo,
      dueDate,
    }: {
      templateId: string
      eventId?: string
      title: string
      assignedTo?: string
      dueDate?: string
    }) => {
      const supabase = createClient()

      // Criar o checklist
      const { data: cl, error: clErr } = await supabase
        .from('checklists')
        .insert({
          title,
          template_id: templateId,
          event_id: eventId ?? null,
          assigned_to: assignedTo ?? null,
          due_date: dueDate ?? null,
          status: 'pending' as ChecklistStatus,
        })
        .select('id')
        .single()

      if (clErr) throw clErr

      // Copiar itens do template
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
        }))
        const { error: itemsErr } = await supabase.from('checklist_items').insert(items)
        if (itemsErr) throw itemsErr
      }

      return cl.id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['checklists'] })
      toast.success('Checklist criado com sucesso!')
    },
    onError: () => toast.error('Erro ao criar checklist.'),
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
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['checklists'] })
      qc.invalidateQueries({ queryKey: ['checklist', id] })
      toast.success('Status atualizado.')
    },
    onError: () => toast.error('Erro ao atualizar status.'),
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
// ATUALIZAR ITEM DO CHECKLIST
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
    }: {
      itemId: string
      checklistId: string
      status?: ChecklistItemStatus
      notes?: string
      photoFile?: File
      userId?: string
    }) => {
      const supabase = createClient()

      let photo_url: string | undefined = undefined

      // Upload de foto se fornecida
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
        } else {
          patch.done_by = null
          patch.done_at = null
        }
      }
      if (notes !== undefined) patch.notes = notes
      if (photo_url !== undefined) patch.photo_url = photo_url

      const { error } = await supabase
        .from('checklist_items')
        .update(patch)
        .eq('id', itemId)

      if (error) throw error
    },
    onSuccess: (_, { checklistId }) => {
      qc.invalidateQueries({ queryKey: ['checklist', checklistId] })
      qc.invalidateQueries({ queryKey: ['checklists'] })
    },
    onError: () => toast.error('Erro ao atualizar item.'),
  })
}

// ─────────────────────────────────────────────────────────────
// TEMPLATES — LISTAR
// ─────────────────────────────────────────────────────────────
export function useChecklistTemplates(onlyActive = true) {
  return useQuery({
    queryKey: ['checklist-templates', onlyActive],
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

      if (onlyActive) query = query.eq('is_active', true)

      const { data, error } = await query
      if (error) throw error

      const result = (data ?? []) as unknown as TemplateWithItems[]
      result.forEach((t) => {
        t.template_items = t.template_items.sort((a, b) => a.sort_order - b.sort_order)
      })
      return result
    },
    staleTime: 5 * 60 * 1000,
  })
}

// ─────────────────────────────────────────────────────────────
// TEMPLATES — DETALHE
// ─────────────────────────────────────────────────────────────
export function useChecklistTemplate(id: string | null) {
  return useQuery({
    queryKey: ['checklist-template', id],
    enabled: !!id,
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
// TEMPLATES — CRIAR
// ─────────────────────────────────────────────────────────────
export function useCreateTemplate() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      title,
      categoryId,
      createdBy,
      items,
    }: {
      title: string
      categoryId: string | null
      createdBy: string
      items: { description: string; sort_order: number }[]
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
        })
        .select('id')
        .single()

      if (tplErr) throw tplErr

      if (items.length > 0) {
        const { error: itemsErr } = await supabase
          .from('template_items')
          .insert(items.map((it) => ({ ...it, template_id: tpl.id })))
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
      items,
    }: {
      id: string
      title: string
      categoryId: string | null
      isActive: boolean
      items: { description: string; sort_order: number }[]
    }) => {
      const supabase = createClient()

      const { error: tplErr } = await supabase
        .from('checklist_templates')
        .update({ title, category_id: categoryId, is_active: isActive })
        .eq('id', id)

      if (tplErr) throw tplErr

      // Substituir todos os itens
      await supabase.from('template_items').delete().eq('template_id', id)
      if (items.length > 0) {
        const { error: itemsErr } = await supabase
          .from('template_items')
          .insert(items.map((it) => ({ ...it, template_id: id })))
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
// TEMPLATES — EXCLUIR
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
  return useQuery({
    queryKey: ['checklist-categories'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('checklist_categories')
        .select('id, name, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    staleTime: 10 * 60 * 1000,
  })
}
