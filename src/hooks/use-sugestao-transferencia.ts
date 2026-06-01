'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'
import type {
  FestaComDecoracaoResumo,
  LinhaSugestaoTransferencia,
} from '@/types/decoracao'

const retry = (count: number, err: unknown) => {
  const status = (err as { status?: number })?.status
  return count < 3 && status !== 401 && status !== 403
}

// ─────────────────────────────────────────────────────────────────────────────
// useFestasComDecoracao — festas ABERTAS com decoração (candidatas do seletor)
// Read-path dourado: SELECT em decoracao_festa é gated por
// check_permission(..., 'decoracao', 'view') na RLS (migrations 131/097).
// ─────────────────────────────────────────────────────────────────────────────

interface FestaComDecoracaoRaw {
  id: string
  event_id: string
  tema: { nome: string | null } | null
  event: {
    title: string | null
    client_name: string | null
    event_date: string | null
    unit: { name: string | null; slug: string | null } | null
  } | null
}

export function useFestasComDecoracao() {
  const isSessionReady = useAuthReadyStore((s: { isSessionReady: boolean }) => s.isSessionReady)
  const supabase = createClient()

  return useQuery({
    queryKey: ['decoracao', 'festas-com-decoracao'],
    enabled: isSessionReady,
    staleTime: 30_000,
    retry,
    queryFn: async (): Promise<FestaComDecoracaoResumo[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('decoracao_festa')
        .select(
          `
          id, event_id,
          tema:decoracao_temas(nome),
          event:events(
            title, client_name, event_date:date,
            unit:units(name, slug)
          )
          `,
        )
        .eq('status', 'aberta')

      if (error) throw error

      return ((data ?? []) as FestaComDecoracaoRaw[])
        .map((row) => ({
          festa_decoracao_id: row.id,
          event_id: row.event_id,
          event_title: row.event?.title ?? null,
          client_name: row.event?.client_name ?? null,
          event_date: row.event?.event_date ?? null,
          unit_name: row.event?.unit?.name ?? null,
          unit_slug: row.event?.unit?.slug ?? null,
          tema_nome: row.tema?.nome ?? null,
        }))
        .sort((a, b) => {
          // Mais próximas primeiro; sem data ao fim.
          if (!a.event_date) return 1
          if (!b.event_date) return -1
          return a.event_date.localeCompare(b.event_date)
        })
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// useSugestaoTransferencia — calcula a falta por item no local da festa e o
// quanto a origem cobre. Cálculo 100% client sobre tabelas RLS já douradas:
//   decoracao_festa_itens + decoracao_estoque_saldo (ambas check_permission view).
// Itens sem falta não entram. falta = max(0, precisa − tem);
// sugerido = min(falta, saldo_origem).
// ─────────────────────────────────────────────────────────────────────────────

interface FestaItemRaw {
  variacao_id: string
  quantidade: number
  variacao: {
    codigo: string | null
    tamanho: string | null
    cor: string | null
    detalhe: string | null
    item: { nome: string | null } | null
  } | null
}

interface SaldoRaw {
  variacao_id: string
  local_id: string
  quantidade: number
}

export function useSugestaoTransferencia(
  festaDecoracaoId: string | undefined,
  destinoLocalId: string | undefined,
  origemLocalId: string | undefined,
) {
  const isSessionReady = useAuthReadyStore((s: { isSessionReady: boolean }) => s.isSessionReady)
  const supabase = createClient()

  return useQuery({
    queryKey: [
      'decoracao',
      'sugestao-transferencia',
      festaDecoracaoId ?? '',
      destinoLocalId ?? '',
      origemLocalId ?? '',
    ],
    enabled:
      isSessionReady &&
      !!festaDecoracaoId &&
      !!destinoLocalId &&
      !!origemLocalId &&
      destinoLocalId !== origemLocalId,
    staleTime: 15_000,
    retry,
    queryFn: async (): Promise<LinhaSugestaoTransferencia[]> => {
      // 1) Itens da festa (precisa = quantidade), hidratados.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: itensData, error: itensErr } = await (supabase as any)
        .from('decoracao_festa_itens')
        .select(
          `
          variacao_id, quantidade,
          variacao:decoracao_item_variacoes(
            codigo, tamanho, cor, detalhe,
            item:decoracao_itens(nome)
          )
          `,
        )
        .eq('festa_decoracao_id', festaDecoracaoId!)

      if (itensErr) throw itensErr

      const itens = (itensData ?? []) as FestaItemRaw[]
      if (itens.length === 0) return []

      const variacaoIds = itens.map((it) => it.variacao_id)

      // 2) Saldo das variações nos dois locais (destino e origem).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: saldosData, error: saldosErr } = await (supabase as any)
        .from('decoracao_estoque_saldo')
        .select('variacao_id, local_id, quantidade')
        .in('variacao_id', variacaoIds)
        .in('local_id', [destinoLocalId!, origemLocalId!])

      if (saldosErr) throw saldosErr

      const saldos = (saldosData ?? []) as SaldoRaw[]

      // Mapas (variacao_id → saldo) por local.
      const saldoDestino = new Map<string, number>()
      const saldoOrigem = new Map<string, number>()
      for (const s of saldos) {
        if (s.local_id === destinoLocalId) saldoDestino.set(s.variacao_id, s.quantidade)
        else if (s.local_id === origemLocalId) saldoOrigem.set(s.variacao_id, s.quantidade)
      }

      // 3) Calcula falta por item; mantém apenas faltas (> 0).
      const linhas: LinhaSugestaoTransferencia[] = itens
        .map((it) => {
          const precisa = it.quantidade
          const tem = saldoDestino.get(it.variacao_id) ?? 0
          const falta = Math.max(0, precisa - tem)
          const saldo_origem = saldoOrigem.get(it.variacao_id) ?? 0
          const sugerido = Math.min(falta, saldo_origem)
          return {
            variacao_id: it.variacao_id,
            codigo: it.variacao?.codigo ?? '—',
            item_nome: it.variacao?.item?.nome ?? '—',
            tamanho: it.variacao?.tamanho ?? null,
            cor: it.variacao?.cor ?? null,
            detalhe: it.variacao?.detalhe ?? null,
            precisa,
            tem,
            falta,
            saldo_origem,
            sugerido,
          }
        })
        .filter((l) => l.falta > 0)
        .sort((a, b) => {
          const an = a.item_nome.localeCompare(b.item_nome, 'pt-BR')
          return an !== 0 ? an : a.codigo.localeCompare(b.codigo)
        })

      return linhas
    },
  })
}
