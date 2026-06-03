'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'
import { useAuth } from '@/hooks/use-auth'
import type {
  CentralServicosLink,
  LinkFormInput,
  LinkFiltroStatus,
} from '@/types/central-servicos'

const retry = (count: number, err: unknown) => {
  const status = (err as { status?: number })?.status
  return count < 3 && status !== 401 && status !== 403
}

async function callJson(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error ?? 'Erro ao salvar. Tente novamente.')
  return json
}

// ────────────────────────────────────────────────────────────
// Listagem
// ────────────────────────────────────────────────────────────

export function useCentralServicosLinks(filtro: LinkFiltroStatus = 'ativos') {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['central-servicos', 'links', filtro],
    enabled: isSessionReady,
    staleTime: 60 * 1000,
    retry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('central_servicos_links')
        .select('*')
        .order('categoria', { ascending: true })
        .order('ordem', { ascending: true })
        .order('nome', { ascending: true })

      if (filtro === 'ativos') query = query.eq('ativo', true)

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as CentralServicosLink[]
    },
  })
}

// ────────────────────────────────────────────────────────────
// Permissões de escrita do usuário atual (via check_permission RPC).
// A RPC trata o bypass de super_admin e respeita os toggles de /admin/cargos.
// ────────────────────────────────────────────────────────────

export interface CentralServicosWritePerms {
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
}

export function useCentralServicosPermissions() {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const { profile } = useAuth()
  const userId = profile?.id

  return useQuery<CentralServicosWritePerms>({
    queryKey: ['central-servicos', 'perms', userId],
    enabled: isSessionReady && !!userId,
    staleTime: 5 * 60 * 1000,
    retry,
    queryFn: async () => {
      const supabase = createClient()
      const ask = (action: 'create' | 'edit' | 'delete') =>
        supabase.rpc('check_permission', {
          p_user_id: userId!,
          p_module: 'central_servicos',
          p_action: action,
        })

      const [c, e, d] = await Promise.all([ask('create'), ask('edit'), ask('delete')])
      if (c.error || e.error || d.error) throw c.error ?? e.error ?? d.error

      return {
        canCreate: c.data === true,
        canEdit: e.data === true,
        canDelete: d.data === true,
      }
    },
  })
}

// ────────────────────────────────────────────────────────────
// Mutations (via API Route — RLS reforça no banco)
// ────────────────────────────────────────────────────────────

export function useCreateLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: LinkFormInput) => {
      const res = await callJson('/api/central-servicos/links', 'POST', input)
      return res?.data?.id as string
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['central-servicos', 'links'] })
      toast.success('Link criado.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: LinkFormInput }) => {
      await callJson(`/api/central-servicos/links/${id}`, 'PATCH', input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['central-servicos', 'links'] })
      toast.success('Link atualizado.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await callJson(`/api/central-servicos/links/${id}`, 'DELETE')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['central-servicos', 'links'] })
      toast.success('Link excluído.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
