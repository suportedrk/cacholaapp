'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'
import type {
  DecoracaoEstoqueSaldo,
  EstoqueVariacaoResumo,
  DecoracaoItemVariacao,
} from '@/types/decoracao'

// ─────────────────────────────────────────────────────────────────────────────
// Chaves de cache
// ─────────────────────────────────────────────────────────────────────────────

export const ESTOQUE_KEYS = {
  all: ['decoracao-estoque'] as const,
  byItem: (itemId: string) => ['decoracao-estoque', 'item', itemId] as const,
  itensComVariacoes: ['decoracao-estoque', 'itens-variacoes'] as const,
}

const retry = (count: number, err: unknown) => {
  const status = (err as { status?: number })?.status
  return count < 3 && status !== 401 && status !== 403
}

// ─────────────────────────────────────────────────────────────────────────────
// useDecoracaoEstoque — todos os saldos (para a tela de estoque)
// ─────────────────────────────────────────────────────────────────────────────

export function useDecoracaoEstoque() {
  const isSessionReady = useAuthReadyStore((s: { isSessionReady: boolean }) => s.isSessionReady)
  const supabase = createClient()

  return useQuery({
    queryKey: ESTOQUE_KEYS.all,
    enabled: isSessionReady,
    staleTime: 30_000,
    retry,
    queryFn: async (): Promise<DecoracaoEstoqueSaldo[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('decoracao_estoque_saldo')
        .select('*')
        .order('variacao_id')
        .order('local_id')

      if (error) throw error
      return (data ?? []) as DecoracaoEstoqueSaldo[]
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// useDecoracaoItensParaEstoque — itens ativos com variações completas
// (campos tamanho/cor/detalhe/codigo/ordem necessários na tabela de estoque)
// ─────────────────────────────────────────────────────────────────────────────

export interface ItemParaEstoque {
  id: string
  nome: string
  variacoes: Pick<DecoracaoItemVariacao, 'id' | 'tamanho' | 'cor' | 'detalhe' | 'codigo' | 'ordem'>[]
}

interface ItemParaEstoqueRaw {
  id: string
  nome: string
  variacoes: Pick<DecoracaoItemVariacao, 'id' | 'tamanho' | 'cor' | 'detalhe' | 'codigo' | 'ordem'>[]
}

export function useDecoracaoItensParaEstoque() {
  const isSessionReady = useAuthReadyStore((s: { isSessionReady: boolean }) => s.isSessionReady)
  const supabase = createClient()

  return useQuery({
    queryKey: ESTOQUE_KEYS.itensComVariacoes,
    enabled: isSessionReady,
    staleTime: 60_000,
    retry,
    queryFn: async (): Promise<ItemParaEstoque[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('decoracao_itens')
        .select('id, nome, variacoes:decoracao_item_variacoes(id, tamanho, cor, detalhe, codigo, ordem)')
        .eq('ativo', true)
        .order('nome', { ascending: true })

      if (error) throw error

      return ((data ?? []) as ItemParaEstoqueRaw[]).map((item) => ({
        id: item.id,
        nome: item.nome,
        variacoes: (item.variacoes ?? []).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
      }))
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// useDecoracaoEstoquePorItem — resumo de saldo para o editor do item (read-only)
// ─────────────────────────────────────────────────────────────────────────────

export function useDecoracaoEstoquePorItem(itemId: string | undefined) {
  const isSessionReady = useAuthReadyStore((s: { isSessionReady: boolean }) => s.isSessionReady)
  const supabase = createClient()

  return useQuery({
    queryKey: ESTOQUE_KEYS.byItem(itemId ?? ''),
    enabled: isSessionReady && !!itemId,
    staleTime: 30_000,
    retry,
    queryFn: async (): Promise<EstoqueVariacaoResumo[]> => {
      // 1. Busca variações do item
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: variacoesRaw, error: vErr } = await (supabase as any)
        .from('decoracao_item_variacoes')
        .select('id, tamanho, cor, detalhe, codigo, ordem')
        .eq('item_id', itemId!)
        .order('ordem', { ascending: true })

      if (vErr) throw vErr

      const variacoes = (variacoesRaw ?? []) as {
        id: string
        tamanho: string | null
        cor: string | null
        detalhe: string | null
        codigo: string
        ordem: number
      }[]
      if (!variacoes.length) return []

      const variacaoIds = variacoes.map((v) => v.id)

      // 2. Busca saldos + locais ativos em paralelo
      const [saldosRes, locaisRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from('decoracao_estoque_saldo')
          .select('variacao_id, local_id, quantidade')
          .in('variacao_id', variacaoIds),
        supabase
          .from('decoracao_locais')
          .select('id, nome')
          .eq('ativo', true)
          .order('nome'),
      ])

      if (saldosRes.error) throw saldosRes.error
      if (locaisRes.error) throw locaisRes.error

      const locaisList = (locaisRes.data ?? []) as { id: string; nome: string }[]

      // Mapa variacao_id → { local_id → quantidade }
      const saldoMap = new Map<string, Record<string, number>>()
      for (const row of (saldosRes.data ?? []) as { variacao_id: string; local_id: string; quantidade: number }[]) {
        if (!saldoMap.has(row.variacao_id)) saldoMap.set(row.variacao_id, {})
        saldoMap.get(row.variacao_id)![row.local_id] = row.quantidade
      }

      return variacoes.map((v) => {
        const saldos = saldoMap.get(v.id) ?? {}
        const total = Object.values(saldos).reduce((acc, q) => acc + q, 0)
        return {
          variacao_id: v.id,
          saldos,
          locais: locaisList,
          total,
        }
      })
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// useUpsertEstoqueSaldo — salva (ou atualiza) quantidade de uma variação num local
// ─────────────────────────────────────────────────────────────────────────────

export interface UpsertSaldoInput {
  variacao_id: string
  local_id: string
  quantidade: number
}

export function useUpsertEstoqueSaldo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpsertSaldoInput) => {
      const res = await fetch('/api/decoracao/estoque', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      return (await res.json()) as DecoracaoEstoqueSaldo
    },
    onSuccess: (saved) => {
      // Invalida o cache geral e o resumo do item dono desta variação
      void queryClient.invalidateQueries({ queryKey: ESTOQUE_KEYS.all })
      // Não sabemos o item_id aqui; invalidar todos os resumos de item
      void queryClient.invalidateQueries({ queryKey: ['decoracao-estoque', 'item'] })
      void saved
    },
  })
}
