'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'
import type {
  DecoracaoItemResumo,
  DecoracaoItemComDetalhes,
  DecoracaoItemVariacao,
  ItemFormInput,
} from '@/types/decoracao'

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

export type ItemFiltro = 'ativos' | 'inativos' | 'todos'

interface ItemListaRow {
  id: string
  nome: string
  tipo: 'proprio' | 'alugado'
  fornecedor_id: string | null
  foto_path: string | null
  observacoes: string | null
  ativo: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  fornecedor: { nome: string } | null
  variacoes: { id: string }[]
}

export function useDecoracaoItens(filtro: ItemFiltro = 'ativos') {
  const isSessionReady = useAuthReadyStore((s: { isSessionReady: boolean }) => s.isSessionReady)
  return useQuery({
    queryKey: ['decoracao', 'itens', filtro],
    enabled: isSessionReady,
    staleTime: 60 * 1000,
    retry,
    queryFn: async (): Promise<DecoracaoItemResumo[]> => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('decoracao_itens')
        .select('*, fornecedor:decoracao_fornecedores(nome), variacoes:decoracao_item_variacoes(id)')
        .order('nome', { ascending: true })

      if (filtro === 'ativos') query = query.eq('ativo', true)
      if (filtro === 'inativos') query = query.eq('ativo', false)

      const { data, error } = await query
      if (error) throw error
      const rows = (data ?? []) as ItemListaRow[]
      return rows.map((r) => ({
        id: r.id,
        nome: r.nome,
        tipo: r.tipo,
        fornecedor_id: r.fornecedor_id,
        foto_path: r.foto_path,
        observacoes: r.observacoes,
        ativo: r.ativo,
        created_by: r.created_by,
        created_at: r.created_at,
        updated_at: r.updated_at,
        fornecedor_nome: r.fornecedor?.nome ?? null,
        variacoes_count: r.variacoes?.length ?? 0,
      }))
    },
  })
}

interface ItemDetalheRow {
  id: string
  nome: string
  tipo: 'proprio' | 'alugado'
  fornecedor_id: string | null
  foto_path: string | null
  observacoes: string | null
  ativo: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  fornecedor: { nome: string } | null
  variacoes: DecoracaoItemVariacao[]
}

export function useDecoracaoItem(id: string | null) {
  const isSessionReady = useAuthReadyStore((s: { isSessionReady: boolean }) => s.isSessionReady)
  return useQuery({
    queryKey: ['decoracao', 'itens', 'detail', id],
    enabled: isSessionReady && !!id,
    staleTime: 30 * 1000,
    retry,
    queryFn: async (): Promise<DecoracaoItemComDetalhes> => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('decoracao_itens')
        .select('*, fornecedor:decoracao_fornecedores(nome), variacoes:decoracao_item_variacoes(*)')
        .eq('id', id)
        .order('ordem', { ascending: true, foreignTable: 'decoracao_item_variacoes' })
        .single()
      if (error) throw error
      const row = data as ItemDetalheRow
      return {
        id: row.id,
        nome: row.nome,
        tipo: row.tipo,
        fornecedor_id: row.fornecedor_id,
        foto_path: row.foto_path,
        observacoes: row.observacoes,
        ativo: row.ativo,
        created_by: row.created_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
        fornecedor_nome: row.fornecedor?.nome ?? null,
        variacoes: (row.variacoes ?? []).sort((a, b) => a.ordem - b.ordem),
      }
    },
  })
}

export function useCreateItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ItemFormInput) => {
      const res = await callJson('/api/decoracao/itens', 'POST', input)
      return res?.data?.id as string
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decoracao', 'itens'] })
      toast.success('Item criado.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ItemFormInput }) => {
      await callJson(`/api/decoracao/itens/${id}`, 'PATCH', input)
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['decoracao', 'itens'] })
      queryClient.invalidateQueries({ queryKey: ['decoracao', 'itens', 'detail', id] })
      toast.success('Item atualizado.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await callJson(`/api/decoracao/itens/${id}`, 'DELETE')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decoracao', 'itens'] })
      toast.success('Item excluído.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
