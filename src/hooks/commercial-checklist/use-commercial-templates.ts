'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'
import { useAuth } from '@/hooks/use-auth'

// ── Types ─────────────────────────────────────────────────────

export interface CommercialTemplate {
  id:                  string
  unit_id:             string | null
  title:               string
  description:         string | null
  default_priority:    'low' | 'medium' | 'high'
  default_due_in_days: number | null
  active:              boolean
  created_by:          string | null
  created_at:          string
  updated_at:          string
  // joined
  unit_name?:          string | null
  creator_name?:       string | null
  items_count?:        number
}

export interface CommercialTemplateFormInput {
  title:               string
  description?:        string
  unit_id?:            string | null
  default_priority?:   'low' | 'medium' | 'high'
  default_due_in_days?: number | null
  active?:             boolean
}

// ── Query keys ────────────────────────────────────────────────

export const commercialTemplatesKeys = {
  all:    ['commercial-templates'] as const,
  list:   (includeInactive: boolean) => ['commercial-templates', 'list', includeInactive] as const,
  detail: (id: string) => ['commercial-templates', 'detail', id] as const,
}

// ── Hooks ─────────────────────────────────────────────────────

export function useCommercialTemplates(includeInactive = false) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const { session } = useAuth()

  return useQuery({
    queryKey: commercialTemplatesKeys.list(includeInactive),
    enabled:  !!session && isSessionReady,
    networkMode: 'always',
    retry: (count, err: unknown) => {
      const e = err as { status?: number }
      return count < 3 && e?.status !== 401 && e?.status !== 403
    },
    queryFn: async () => {
      const supabase = createClient()
      let q = supabase
        .from('commercial_task_templates')
        .select(`
          id, unit_id, title, description, default_priority,
          default_due_in_days, active, created_by, created_at, updated_at,
          units(name),
          users!commercial_task_templates_created_by_fkey(name)
        `)
        .order('active', { ascending: false })
        .order('title')

      if (!includeInactive) {
        q = q.eq('active', true)
      }

      const { data, error } = await q
      if (error) throw error

      return (data as unknown as Array<{
        id: string; unit_id: string | null; title: string; description: string | null
        default_priority: 'low' | 'medium' | 'high'; default_due_in_days: number | null
        active: boolean; created_by: string | null; created_at: string; updated_at: string
        units: { name: string } | null
        users: { name: string } | null
      }>).map((row) => ({
        ...row,
        unit_name:    row.units?.name ?? null,
        creator_name: row.users?.name ?? null,
      }))
    },
  })
}

export function useCommercialTemplate(id: string | null) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const { session } = useAuth()

  return useQuery({
    queryKey: commercialTemplatesKeys.detail(id ?? ''),
    enabled:  !!session && isSessionReady && !!id,
    networkMode: 'always',
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('commercial_task_templates')
        .select(`
          id, unit_id, title, description, default_priority,
          default_due_in_days, active, created_by, created_at, updated_at,
          units(name),
          users!commercial_task_templates_created_by_fkey(name)
        `)
        .eq('id', id!)
        .single()

      if (error) throw error

      const row = data as unknown as {
        id: string; unit_id: string | null; title: string; description: string | null
        default_priority: 'low' | 'medium' | 'high'; default_due_in_days: number | null
        active: boolean; created_by: string | null; created_at: string; updated_at: string
        units: { name: string } | null
        users: { name: string } | null
      }

      return {
        ...row,
        unit_name:    row.units?.name ?? null,
        creator_name: row.users?.name ?? null,
      }
    },
  })
}

export function useCreateCommercialTemplate() {
  const qc = useQueryClient()
  const { session } = useAuth()

  return useMutation({
    mutationFn: async (input: CommercialTemplateFormInput) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('commercial_task_templates')
        .insert({ ...input, created_by: session?.user.id })
        .select('id')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commercialTemplatesKeys.all })
    },
  })
}

export function useUpdateCommercialTemplate() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: CommercialTemplateFormInput & { id: string }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('commercial_task_templates')
        .update(input)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: commercialTemplatesKeys.all })
      qc.invalidateQueries({ queryKey: commercialTemplatesKeys.detail(id) })
    },
  })
}

export function useSoftDeleteCommercialTemplate() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('commercial_task_templates')
        .update({ active: false })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commercialTemplatesKeys.all })
    },
  })
}
