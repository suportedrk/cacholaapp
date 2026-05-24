'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'
import type { DecoracaoLocal, LocalFormInput } from '@/types/decoracao'

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

export type LocalFiltro = 'ativos' | 'inativos' | 'todos'

export function useDecoracaoLocais(filtro: LocalFiltro = 'ativos') {
  const isSessionReady = useAuthReadyStore((s: { isSessionReady: boolean }) => s.isSessionReady)
  return useQuery({
    queryKey: ['decoracao', 'locais', filtro],
    enabled: isSessionReady,
    staleTime: 60 * 1000,
    retry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('decoracao_locais')
        .select('*')
        .order('nome', { ascending: true })

      if (filtro === 'ativos') query = query.eq('ativo', true)
      if (filtro === 'inativos') query = query.eq('ativo', false)

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as DecoracaoLocal[]
    },
  })
}

export function useCreateLocal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: LocalFormInput) => {
      const res = await callJson('/api/decoracao/locais', 'POST', input)
      return res?.data?.id as string
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decoracao', 'locais'] })
      toast.success('Local criado.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateLocal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: LocalFormInput }) => {
      await callJson(`/api/decoracao/locais/${id}`, 'PATCH', input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decoracao', 'locais'] })
      toast.success('Local atualizado.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteLocal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await callJson(`/api/decoracao/locais/${id}`, 'DELETE')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decoracao', 'locais'] })
      toast.success('Local excluído.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
