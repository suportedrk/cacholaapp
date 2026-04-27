'use client'

/**
 * Hooks para leitura das tabelas de catálogo RBAC (modules, roles, role_permissions).
 *
 * Estas tabelas não estão em database.types.ts — regeneração agendada para PR 3.
 * Por isso, .from('modules') etc. usam .returns<T[]>() para manter tipagem.
 *
 * NÃO confundir com use-permissions.ts:
 *   - use-rbac-catalogs → lê o catálogo canônico (templates de cargo × módulo)
 *   - use-permissions   → lê user_permissions (overrides aplicados por usuário)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'
import { toast } from 'sonner'

export interface ModuleRow {
  code: string
  label: string
  description: string | null
  icon: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface RoleRow {
  code: string
  label: string
  description: string | null
  sort_order: number
  is_active: boolean
  is_system: boolean
  created_at: string
  updated_at: string
}

const RETRY = (count: number, err: unknown) => {
  const status = (err as { status?: number })?.status
  return count < 3 && status !== 401 && status !== 403
}

export function useModules() {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  return useQuery({
    queryKey: ['rbac', 'modules'],
    enabled: isSessionReady,
    staleTime: 5 * 60 * 1000,
    retry: RETRY,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('modules')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .returns<ModuleRow[]>()
      if (error) throw error
      return (data ?? []) as ModuleRow[]
    },
  })
}

export function useRoles() {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  return useQuery({
    queryKey: ['rbac', 'roles'],
    enabled: isSessionReady,
    staleTime: 5 * 60 * 1000,
    retry: RETRY,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .returns<RoleRow[]>()
      if (error) throw error
      return (data ?? []) as RoleRow[]
    },
  })
}

// ─────────────────────────────────────────────────────────────
// role_permissions — templates de cargo × módulo × ação
// ─────────────────────────────────────────────────────────────

export interface RolePermissionRow {
  role_code: string
  module_code: string
  action: string
  granted: boolean
}

export function useRolePermissions(roleCode: string) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  return useQuery({
    queryKey: ['rbac', 'role-permissions', roleCode],
    enabled: isSessionReady && !!roleCode,
    staleTime: 60 * 1000,
    retry: RETRY,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('role_permissions')
        .select('role_code, module_code, action, granted')
        .eq('role_code', roleCode)
        .returns<RolePermissionRow[]>()
      if (error) throw error
      return (data ?? []) as RolePermissionRow[]
    },
  })
}

export function useUpdateRolePermission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      role_code: string
      module_code: string
      action: string
      granted: boolean
    }) => {
      const res = await fetch('/api/admin/role-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<{ success: boolean; role_code: string }>
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rbac'] })
      toast.success('Template atualizado')
    },
    onError: () => toast.error('Erro ao atualizar template.'),
  })
}

export interface ApplyToAllResult {
  success: boolean
  succeeded: { user_id: string; email: string; permissions_changed: number }[]
  failed: { user_id: string; email: string; error_message: string }[]
  total_users: number
  total_succeeded: number
  total_failed: number
}

export function useApplyTemplateToAllUsers() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (roleCode: string): Promise<ApplyToAllResult> => {
      const res = await fetch(`/api/admin/roles/${roleCode}/apply-to-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      })
      const json = await res.json() as ApplyToAllResult
      if (!res.ok && res.status !== 207) throw new Error(JSON.stringify(json))
      return json
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['rbac'] })
      qc.invalidateQueries({ queryKey: ['permissions'] })
      if (data.total_failed === 0) {
        toast.success(`Template aplicado a ${data.total_succeeded} usuário(s).`)
      }
    },
    onError: () => toast.error('Erro ao aplicar template em massa.'),
  })
}
