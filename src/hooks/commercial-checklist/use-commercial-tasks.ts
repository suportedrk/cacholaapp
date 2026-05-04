'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'
import { useAuth } from '@/hooks/use-auth'
import { hasRole, VENDEDORA_ROLES } from '@/config/roles'
import type { Role } from '@/types/permissions'

// ── Types ─────────────────────────────────────────────────────

export type CommercialTaskStatus   = 'pending' | 'in_progress' | 'completed' | 'cancelled'
export type CommercialTaskPriority = 'low' | 'medium' | 'high'
export type CommercialTaskSource   = 'manual' | 'template' | 'automation'
export type MyTasksFilter          = 'today' | 'overdue' | 'upcoming_7d' | 'all'

export interface CommercialTask {
  id:                   string
  unit_id:              string
  assignee_id:          string
  title:                string
  description:          string | null
  priority:             CommercialTaskPriority | null
  status:               CommercialTaskStatus
  due_date:             string | null
  source:               CommercialTaskSource
  template_id:          string | null
  linked_entity_type:   string | null
  linked_entity_id:     string | null
  notes:                string | null
  created_by:           string | null
  created_at:           string
  updated_at:           string
  // Fase 2 — automação por stage Ploomes
  automation_deal_id:   number | null
  automation_stage_id:  number | null
  automation_source_id: string | null
  // joined
  assignee_name?:       string | null
  unit_name?:           string | null
}

export interface CommercialTaskFormInput {
  title:       string
  description?: string
  priority?:   CommercialTaskPriority
  due_date?:   string | null
  notes?:      string
  unit_id:     string
  assignee_id: string
}

export interface TeamTaskFilters {
  unitId?:     string
  assigneeId?: string
  status?:     CommercialTaskStatus | ''
  priority?:   CommercialTaskPriority | ''
}

// ── Query keys ────────────────────────────────────────────────

export const commercialTasksKeys = {
  all:      ['commercial-tasks'] as const,
  myTasks:  (filter: MyTasksFilter) => ['commercial-tasks', 'my', filter] as const,
  team:     (filters: TeamTaskFilters) => ['commercial-tasks', 'team', filters] as const,
}

// ── Helpers ───────────────────────────────────────────────────

function todayIso() {
  return new Date().toISOString().split('T')[0]
}

function plusDaysIso(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// ── Hooks ─────────────────────────────────────────────────────

export function useMyCommercialTasks(filter: MyTasksFilter = 'today') {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const { session } = useAuth()

  return useQuery({
    queryKey: commercialTasksKeys.myTasks(filter),
    enabled:  !!session && isSessionReady,
    networkMode: 'always',
    retry: (count, err: unknown) => {
      const e = err as { status?: number }
      return count < 3 && e?.status !== 401 && e?.status !== 403
    },
    queryFn: async () => {
      const supabase = createClient()
      let q = supabase
        .from('commercial_tasks')
        .select(`
          id, unit_id, assignee_id, title, description, priority,
          status, due_date, source, template_id, linked_entity_type,
          linked_entity_id, notes, created_by, created_at, updated_at,
          automation_deal_id, automation_stage_id, automation_source_id,
          units(name)
        `)
        .not('status', 'in', '("completed","cancelled")')
        .order('due_date', { ascending: true, nullsFirst: false })

      const today = todayIso()
      const in7   = plusDaysIso(7)

      if (filter === 'today') {
        q = q.lte('due_date', `${today}T23:59:59`)
      } else if (filter === 'overdue') {
        q = q.lt('due_date', `${today}T00:00:00`)
      } else if (filter === 'upcoming_7d') {
        q = q
          .gte('due_date', `${today}T00:00:00`)
          .lte('due_date', `${in7}T23:59:59`)
      }

      const { data, error } = await q
      if (error) throw error

      return (data as unknown as Array<CommercialTask & { units: { name: string } | null }>).map(
        (row) => ({ ...row, unit_name: row.units?.name ?? null })
      )
    },
  })
}

export function useTeamCommercialTasks(filters: TeamTaskFilters = {}) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const { session } = useAuth()

  return useQuery({
    queryKey: commercialTasksKeys.team(filters),
    enabled:  !!session && isSessionReady,
    networkMode: 'always',
    retry: (count, err: unknown) => {
      const e = err as { status?: number }
      return count < 3 && e?.status !== 401 && e?.status !== 403
    },
    queryFn: async () => {
      const supabase = createClient()
      let q = supabase
        .from('commercial_tasks')
        .select(`
          id, unit_id, assignee_id, title, description, priority,
          status, due_date, source, template_id, linked_entity_type,
          linked_entity_id, notes, created_by, created_at, updated_at,
          automation_deal_id, automation_stage_id, automation_source_id,
          users!commercial_tasks_assignee_id_fkey(name),
          units(name)
        `)
        .order('due_date', { ascending: true, nullsFirst: false })

      if (filters.unitId)     q = q.eq('unit_id', filters.unitId)
      if (filters.assigneeId) q = q.eq('assignee_id', filters.assigneeId)
      if (filters.status)     q = q.eq('status', filters.status)
      if (filters.priority)   q = q.eq('priority', filters.priority)

      const { data, error } = await q
      if (error) throw error

      return (data as unknown as Array<CommercialTask & {
        users: { name: string } | null
        units: { name: string } | null
      }>).map((row) => ({
        ...row,
        assignee_name: row.users?.name ?? null,
        unit_name:     row.units?.name ?? null,
      }))
    },
  })
}

export function useCreateCommercialTask() {
  const qc = useQueryClient()
  const { session } = useAuth()

  return useMutation({
    mutationFn: async (input: CommercialTaskFormInput) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('commercial_tasks')
        .insert({ ...input, source: 'manual', created_by: session?.user.id })
        .select('id')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commercialTasksKeys.all })
    },
  })
}

export function useUpdateCommercialTask() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: Partial<CommercialTaskFormInput> & { id: string; status?: CommercialTaskStatus; notes?: string }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('commercial_tasks')
        .update(input)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commercialTasksKeys.all })
    },
  })
}

export function useCompleteCommercialTask() {
  const qc = useQueryClient()
  const { session } = useAuth()

  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const supabase = createClient()

      // 1. Read current status for the completion log
      const { data: task } = await supabase
        .from('commercial_tasks')
        .select('status')
        .eq('id', id)
        .single()

      // 2. Update task status
      const { error: updateErr } = await supabase
        .from('commercial_tasks')
        .update({ status: 'completed' })
        .eq('id', id)
      if (updateErr) throw updateErr

      // 3. Insert completion log
      const { error: logErr } = await supabase
        .from('commercial_task_completions')
        .insert({
          task_id:         id,
          completed_by:    session?.user.id,
          notes:           notes ?? null,
          previous_status: task?.status ?? null,
        })
      if (logErr) throw logErr
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commercialTasksKeys.all })
    },
  })
}

export function useDeleteCommercialTask() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('commercial_tasks')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commercialTasksKeys.all })
    },
  })
}

// ── Vendedoras para assign ────────────────────────────────────

export interface AssignableUser {
  id:   string
  name: string
}

export function useCommercialChecklistAssignees(unitId: string | null | undefined) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const { session } = useAuth()

  return useQuery({
    queryKey: ['commercial-checklist-assignees', unitId ?? 'global'],
    enabled:  !!session && isSessionReady,
    networkMode: 'always',
    queryFn: async () => {
      const supabase = createClient()

      if (unitId) {
        // Template de unidade: listar vendedoras daquela unidade
        const { data, error } = await supabase
          .from('user_units')
          .select('user_id, users!inner(id, name, role)')
          .eq('unit_id', unitId)

        if (error) throw error

        return (data as unknown as Array<{ users: { id: string; name: string; role: string } }>)
          .map((row) => row.users)
          .filter((u) => hasRole(u.role as Role, VENDEDORA_ROLES))
          .map(({ id, name }) => ({ id, name })) as AssignableUser[]
      } else {
        // Template global: listar todas as vendedoras
        const { data, error } = await supabase
          .from('users')
          .select('id, name')
          .eq('role', 'vendedora')
          .order('name')

        if (error) throw error
        return data as AssignableUser[]
      }
    },
  })
}
