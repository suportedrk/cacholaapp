'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'
import { useAuth } from '@/hooks/use-auth'

// ── Types ─────────────────────────────────────────────────────

export interface CommercialAutomation {
  id:            string
  unit_id:       string | null
  stage_id:      number
  stage_name:    string | null
  template_id:   string
  active:        boolean
  created_by:    string | null
  created_at:    string
  updated_at:    string
  // joined
  template_title?: string | null
  unit_name?:      string | null
}

export interface CommercialAutomationFormInput {
  unit_id:     string | null
  stage_id:    number
  stage_name:  string | null
  template_id: string
}

// ── Query keys ────────────────────────────────────────────────

export const automationKeys = {
  all:  ['commercial-automations'] as const,
  list: () => ['commercial-automations', 'list'] as const,
}

// ── Hooks ─────────────────────────────────────────────────────

export function useCommercialAutomations() {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const { session } = useAuth()

  return useQuery({
    queryKey: automationKeys.list(),
    enabled:  !!session && isSessionReady,
    networkMode: 'always',
    retry: (count, err: unknown) => {
      const e = err as { status?: number }
      return count < 3 && e?.status !== 401 && e?.status !== 403
    },
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('commercial_stage_automations')
        .select(`
          id, unit_id, stage_id, stage_name, template_id,
          active, created_by, created_at, updated_at,
          commercial_task_templates!inner(title),
          units(name)
        `)
        .order('active', { ascending: false })
        .order('stage_name', { ascending: true })

      if (error) throw error

      return (data as unknown as Array<CommercialAutomation & {
        commercial_task_templates: { title: string } | null
        units: { name: string } | null
      }>).map((row) => ({
        ...row,
        template_title: row.commercial_task_templates?.title ?? null,
        unit_name:      row.units?.name ?? null,
      }))
    },
  })
}

export function useCreateCommercialAutomation() {
  const qc = useQueryClient()
  const { session } = useAuth()

  return useMutation({
    mutationFn: async (input: CommercialAutomationFormInput) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('commercial_stage_automations')
        .insert({ ...input, created_by: session?.user.id })
        .select('id')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: automationKeys.all })
    },
  })
}

export function useUpdateCommercialAutomation() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: Partial<CommercialAutomationFormInput> & { id: string; active?: boolean }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('commercial_stage_automations')
        .update(input)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: automationKeys.all })
    },
  })
}

export function useDeleteCommercialAutomation() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('commercial_stage_automations')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: automationKeys.all })
    },
  })
}
