'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'
import type { DecoracaoFornecedor, FornecedorFormInput } from '@/types/decoracao'

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

export type FornecedorFiltro = 'ativos' | 'inativos' | 'todos'

export function useDecoracaoFornecedores(filtro: FornecedorFiltro = 'ativos') {
  const isSessionReady = useAuthReadyStore((s: { isSessionReady: boolean }) => s.isSessionReady)
  return useQuery({
    queryKey: ['decoracao', 'fornecedores', filtro],
    enabled: isSessionReady,
    staleTime: 60 * 1000,
    retry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('decoracao_fornecedores')
        .select('*')
        .order('nome', { ascending: true })

      if (filtro === 'ativos') query = query.eq('ativo', true)
      if (filtro === 'inativos') query = query.eq('ativo', false)

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as DecoracaoFornecedor[]
    },
  })
}

export function useCreateFornecedor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: FornecedorFormInput) => {
      const res = await callJson('/api/decoracao/fornecedores', 'POST', input)
      return res?.data?.id as string
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decoracao', 'fornecedores'] })
      toast.success('Fornecedor criado.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateFornecedor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: FornecedorFormInput }) => {
      await callJson(`/api/decoracao/fornecedores/${id}`, 'PATCH', input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decoracao', 'fornecedores'] })
      toast.success('Fornecedor atualizado.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteFornecedor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await callJson(`/api/decoracao/fornecedores/${id}`, 'DELETE')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decoracao', 'fornecedores'] })
      toast.success('Fornecedor excluído.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
