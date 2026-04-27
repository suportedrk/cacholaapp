'use client'

/**
 * Hooks para leitura das tabelas de catálogo RBAC (modules, roles).
 *
 * Estas tabelas não estão em database.types.ts — regeneração agendada para PR 3.
 * Por isso, .from('modules') e .from('roles') usam @ts-expect-error explícito
 * com .returns<T[]>() para manter tipagem no resultado.
 *
 * NÃO confundir com use-permissions.ts:
 *   - use-rbac-catalogs → lê o catálogo canônico (templates de cargo × módulo)
 *   - use-permissions   → lê user_permissions (overrides aplicados por usuário)
 */

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'

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
