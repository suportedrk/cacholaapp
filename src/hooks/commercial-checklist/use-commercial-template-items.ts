'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'
import { useAuth } from '@/hooks/use-auth'
import { commercialTemplatesKeys } from './use-commercial-templates'

// ── Types ─────────────────────────────────────────────────────

export interface CommercialTemplateItem {
  id:          string
  template_id: string
  title:       string
  description: string | null
  priority:    'low' | 'medium' | 'high'
  due_in_days: number | null
  sort_order:  number
  created_at:  string
}

export interface CommercialTemplateItemFormInput {
  title:       string
  description?: string
  priority?:   'low' | 'medium' | 'high'
  due_in_days?: number | null
  sort_order?: number
}

// ── Query keys ────────────────────────────────────────────────

export const commercialTemplateItemsKeys = {
  all:  (templateId: string) => ['commercial-template-items', templateId] as const,
}

// ── Hooks ─────────────────────────────────────────────────────

export function useCommercialTemplateItems(templateId: string | null) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const { session } = useAuth()

  return useQuery({
    queryKey: commercialTemplateItemsKeys.all(templateId ?? ''),
    enabled:  !!session && isSessionReady && !!templateId,
    networkMode: 'always',
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('commercial_template_items')
        .select('id, template_id, title, description, priority, due_in_days, sort_order, created_at')
        .eq('template_id', templateId!)
        .order('sort_order')

      if (error) throw error
      return data as CommercialTemplateItem[]
    },
  })
}

export function useCreateCommercialTemplateItem() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ templateId, ...input }: CommercialTemplateItemFormInput & { templateId: string }) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('commercial_template_items')
        .insert({ template_id: templateId, ...input })
        .select('id')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, { templateId }) => {
      qc.invalidateQueries({ queryKey: commercialTemplateItemsKeys.all(templateId) })
      qc.invalidateQueries({ queryKey: commercialTemplatesKeys.all })
    },
  })
}

export function useUpdateCommercialTemplateItem() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      templateId: _templateId,
      ...input
    }: CommercialTemplateItemFormInput & { id: string; templateId: string }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('commercial_template_items')
        .update(input)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, { templateId }) => {
      qc.invalidateQueries({ queryKey: commercialTemplateItemsKeys.all(templateId) })
    },
  })
}

export function useDeleteCommercialTemplateItem() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id }: { id: string; templateId: string }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('commercial_template_items')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, { templateId }) => {
      qc.invalidateQueries({ queryKey: commercialTemplateItemsKeys.all(templateId) })
      qc.invalidateQueries({ queryKey: commercialTemplatesKeys.all })
    },
  })
}

export function useReorderCommercialTemplateItems() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      templateId: _templateId,
      orderedIds,
    }: {
      templateId: string
      orderedIds: string[]
    }) => {
      const supabase = createClient()
      // Update sort_order for each item in parallel
      await Promise.all(
        orderedIds.map((id, index) =>
          supabase
            .from('commercial_template_items')
            .update({ sort_order: index })
            .eq('id', id)
        )
      )
    },
    onSuccess: (_data, { templateId }) => {
      qc.invalidateQueries({ queryKey: commercialTemplateItemsKeys.all(templateId) })
    },
  })
}
