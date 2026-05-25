'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'
import { ESTOQUE_KEYS } from '@/hooks/use-decoracao-estoque'
import type {
  CriarTransferenciaInput,
  TransferenciaComItens,
  TransferenciaItemHidratado,
  TransferenciaResumo,
  TransferenciaStatus,
} from '@/types/decoracao'

// ─────────────────────────────────────────────────────────────────────────────
// Chaves de cache
// ─────────────────────────────────────────────────────────────────────────────

export const TRANSFERENCIAS_KEYS = {
  all: ['decoracao-transferencias'] as const,
  list: (status: TransferenciaStatus | 'todas') =>
    ['decoracao-transferencias', 'list', status] as const,
  detail: (id: string) => ['decoracao-transferencias', 'detail', id] as const,
}

const retry = (count: number, err: unknown) => {
  const status = (err as { status?: number })?.status
  return count < 3 && status !== 401 && status !== 403
}

// ─────────────────────────────────────────────────────────────────────────────
// useTransferencias — listagem com filtro de status
// ─────────────────────────────────────────────────────────────────────────────

interface TransferenciaRaw {
  id: string
  origem_local_id: string
  destino_local_id: string
  status: TransferenciaStatus
  observacoes: string | null
  created_by: string | null
  recebido_por: string | null
  data_envio: string
  data_recebimento: string | null
  created_at: string
  updated_at: string
  origem: { nome: string } | null
  destino: { nome: string } | null
  created_by_user: { name: string | null } | null
  recebido_por_user: { name: string | null } | null
  itens: { id: string }[]
}

export function useTransferencias(statusFilter: TransferenciaStatus | 'todas') {
  const isSessionReady = useAuthReadyStore((s: { isSessionReady: boolean }) => s.isSessionReady)
  const supabase = createClient()

  return useQuery({
    queryKey: TRANSFERENCIAS_KEYS.list(statusFilter),
    enabled: isSessionReady,
    staleTime: 15_000,
    retry,
    queryFn: async (): Promise<TransferenciaResumo[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase as any)
        .from('decoracao_transferencias')
        .select(
          `
          id, origem_local_id, destino_local_id, status, observacoes,
          created_by, recebido_por, data_envio, data_recebimento, created_at, updated_at,
          origem:decoracao_locais!decoracao_transferencias_origem_local_id_fkey(nome),
          destino:decoracao_locais!decoracao_transferencias_destino_local_id_fkey(nome),
          created_by_user:users!decoracao_transferencias_created_by_fkey(name),
          recebido_por_user:users!decoracao_transferencias_recebido_por_fkey(name),
          itens:decoracao_transferencia_itens(id)
          `,
        )
        .order('data_envio', { ascending: false })

      if (statusFilter !== 'todas') q = q.eq('status', statusFilter)

      const { data, error } = await q
      if (error) throw error

      return ((data ?? []) as TransferenciaRaw[]).map((t) => ({
        id: t.id,
        origem_local_id: t.origem_local_id,
        destino_local_id: t.destino_local_id,
        status: t.status,
        observacoes: t.observacoes,
        created_by: t.created_by,
        recebido_por: t.recebido_por,
        data_envio: t.data_envio,
        data_recebimento: t.data_recebimento,
        created_at: t.created_at,
        updated_at: t.updated_at,
        origem_nome: t.origem?.nome ?? '—',
        destino_nome: t.destino?.nome ?? '—',
        created_by_nome: t.created_by_user?.name ?? null,
        recebido_por_nome: t.recebido_por_user?.name ?? null,
        itens_count: t.itens?.length ?? 0,
      }))
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// useTransferencia — detalhe + itens hidratados
// ─────────────────────────────────────────────────────────────────────────────

interface TransferenciaDetailRaw extends Omit<TransferenciaRaw, 'itens'> {
  itens: {
    id: string
    transferencia_id: string
    variacao_id: string
    quantidade: number
    created_at: string
    variacao: {
      codigo: string
      tamanho: string | null
      cor: string | null
      detalhe: string | null
      item: { nome: string } | null
    } | null
  }[]
}

export function useTransferencia(id: string | undefined) {
  const isSessionReady = useAuthReadyStore((s: { isSessionReady: boolean }) => s.isSessionReady)
  const supabase = createClient()

  return useQuery({
    queryKey: TRANSFERENCIAS_KEYS.detail(id ?? ''),
    enabled: isSessionReady && !!id,
    staleTime: 15_000,
    retry,
    queryFn: async (): Promise<TransferenciaComItens> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('decoracao_transferencias')
        .select(
          `
          id, origem_local_id, destino_local_id, status, observacoes,
          created_by, recebido_por, data_envio, data_recebimento, created_at, updated_at,
          origem:decoracao_locais!decoracao_transferencias_origem_local_id_fkey(nome),
          destino:decoracao_locais!decoracao_transferencias_destino_local_id_fkey(nome),
          created_by_user:users!decoracao_transferencias_created_by_fkey(name),
          recebido_por_user:users!decoracao_transferencias_recebido_por_fkey(name),
          itens:decoracao_transferencia_itens(
            id, transferencia_id, variacao_id, quantidade, created_at,
            variacao:decoracao_item_variacoes(
              codigo, tamanho, cor, detalhe,
              item:decoracao_itens(nome)
            )
          )
          `,
        )
        .eq('id', id!)
        .single()

      if (error) throw error
      const t = data as TransferenciaDetailRaw

      const itens: TransferenciaItemHidratado[] = (t.itens ?? []).map((it) => ({
        id: it.id,
        transferencia_id: it.transferencia_id,
        variacao_id: it.variacao_id,
        quantidade: it.quantidade,
        created_at: it.created_at,
        variacao_codigo: it.variacao?.codigo ?? '—',
        variacao_tamanho: it.variacao?.tamanho ?? null,
        variacao_cor: it.variacao?.cor ?? null,
        variacao_detalhe: it.variacao?.detalhe ?? null,
        item_nome: it.variacao?.item?.nome ?? '—',
      }))

      return {
        id: t.id,
        origem_local_id: t.origem_local_id,
        destino_local_id: t.destino_local_id,
        status: t.status,
        observacoes: t.observacoes,
        created_by: t.created_by,
        recebido_por: t.recebido_por,
        data_envio: t.data_envio,
        data_recebimento: t.data_recebimento,
        created_at: t.created_at,
        updated_at: t.updated_at,
        origem_nome: t.origem?.nome ?? '—',
        destino_nome: t.destino?.nome ?? '—',
        created_by_nome: t.created_by_user?.name ?? null,
        recebido_por_nome: t.recebido_por_user?.name ?? null,
        itens_count: itens.length,
        itens,
      }
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

function invalidateTransfersAndEstoque(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: TRANSFERENCIAS_KEYS.all })
  void qc.invalidateQueries({ queryKey: ESTOQUE_KEYS.all })
  // Resumo por item também depende do saldo
  void qc.invalidateQueries({ queryKey: ['decoracao-estoque', 'item'] })
}

export function useCriarTransferencia() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: CriarTransferenciaInput): Promise<string> => {
      const res = await fetch('/api/decoracao/transferencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const data = (await res.json()) as { id: string }
      return data.id
    },
    onSuccess: () => invalidateTransfersAndEstoque(qc),
  })
}

export function useReceberTransferencia() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const res = await fetch(`/api/decoracao/transferencias/${id}/receber`, {
        method: 'POST',
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
    },
    onSuccess: () => invalidateTransfersAndEstoque(qc),
  })
}

export function useCancelarTransferencia() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const res = await fetch(`/api/decoracao/transferencias/${id}/cancelar`, {
        method: 'POST',
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
    },
    onSuccess: () => invalidateTransfersAndEstoque(qc),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// useEstoqueSaldoOrigem — saldo por variação NO LOCAL de origem (para sheet criar)
// Apenas variações que TÊM saldo > 0 na origem.
// ─────────────────────────────────────────────────────────────────────────────

export interface VariacaoComSaldoNaOrigem {
  variacao_id: string
  codigo: string
  tamanho: string | null
  cor: string | null
  detalhe: string | null
  item_nome: string
  saldo: number
}

interface SaldoOrigemRaw {
  variacao_id: string
  quantidade: number
  variacao: {
    codigo: string
    tamanho: string | null
    cor: string | null
    detalhe: string | null
    item: { nome: string } | null
  } | null
}

export function useEstoqueSaldoOrigem(origemLocalId: string | undefined) {
  const isSessionReady = useAuthReadyStore((s: { isSessionReady: boolean }) => s.isSessionReady)
  const supabase = createClient()

  return useQuery({
    queryKey: ['decoracao-estoque', 'origem', origemLocalId ?? ''],
    enabled: isSessionReady && !!origemLocalId,
    staleTime: 15_000,
    retry,
    queryFn: async (): Promise<VariacaoComSaldoNaOrigem[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('decoracao_estoque_saldo')
        .select(
          `
          variacao_id, quantidade,
          variacao:decoracao_item_variacoes(
            codigo, tamanho, cor, detalhe,
            item:decoracao_itens(nome)
          )
          `,
        )
        .eq('local_id', origemLocalId!)
        .gt('quantidade', 0)

      if (error) throw error

      return ((data ?? []) as SaldoOrigemRaw[])
        .map((row) => ({
          variacao_id: row.variacao_id,
          codigo: row.variacao?.codigo ?? '—',
          tamanho: row.variacao?.tamanho ?? null,
          cor: row.variacao?.cor ?? null,
          detalhe: row.variacao?.detalhe ?? null,
          item_nome: row.variacao?.item?.nome ?? '—',
          saldo: row.quantidade,
        }))
        .sort((a, b) => {
          const an = a.item_nome.localeCompare(b.item_nome, 'pt-BR')
          return an !== 0 ? an : a.codigo.localeCompare(b.codigo)
        })
    },
  })
}
