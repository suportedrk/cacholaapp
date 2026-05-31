'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'
import type {
  DecoracaoForminhaCor,
  DecoracaoTemaComForminhas,
  ForminhaCorFormInput,
  ForminhaCorCreateInput,
  TemaFormInput,
  TemaForminhaResumo,
  TemaReceitaLinha,
  VariacaoCatalogo,
  FestaDecoracaoCompleta,
  FestaItemLinha,
  FestaItemInput,
  DecoracaoBalaoModelo,
  BalaoModeloFormInput,
} from '@/types/decoracao'

const retry = (count: number, err: unknown) => {
  const status = (err as { status?: number })?.status
  return count < 3 && status !== 401 && status !== 403
}

async function postJson(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error ?? 'Erro ao salvar. Tente novamente.')
  return json
}

// ── Cores de forminha ────────────────────────────────────────

export function useForminhaCores() {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  return useQuery({
    queryKey: ['decoracao', 'forminhas'],
    enabled: isSessionReady,
    staleTime: 5 * 60 * 1000,
    retry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('decoracao_forminha_cores')
        .select('*')
        .order('numero')
      if (error) throw error
      return (data ?? []) as DecoracaoForminhaCor[]
    },
  })
}

export function useCreateForminhaCor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ForminhaCorCreateInput) => {
      await postJson('/api/decoracao/forminhas', 'POST', input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decoracao', 'forminhas'] })
      toast.success('Cor de forminha criada.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateForminhaCor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ForminhaCorFormInput }) => {
      await postJson(`/api/decoracao/forminhas/${id}`, 'PATCH', input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decoracao', 'forminhas'] })
      // Temas exibem as bolinhas das forminhas — refletir nome/cor atualizados.
      queryClient.invalidateQueries({ queryKey: ['decoracao', 'temas'] })
      toast.success('Cor de forminha atualizada.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ── Temas ────────────────────────────────────────────────────

export function useDecoracaoTemas() {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  return useQuery({
    queryKey: ['decoracao', 'temas'],
    enabled: isSessionReady,
    staleTime: 5 * 60 * 1000,
    retry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('decoracao_temas')
        .select(
          '*, decoracao_tema_forminhas(decoracao_forminha_cores(id, numero, nome, cor_hex))',
        )
        .order('nome')
      if (error) throw error

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((data ?? []) as any[]).map((row): DecoracaoTemaComForminhas => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const links = (row.decoracao_tema_forminhas ?? []) as any[]
        const forminhas = links
          .map((l) => l.decoracao_forminha_cores as TemaForminhaResumo | null)
          .filter((f): f is TemaForminhaResumo => f != null)
          .sort((a, b) => a.numero - b.numero)
        const { decoracao_tema_forminhas: _drop, ...tema } = row
        void _drop
        return { ...tema, forminhas }
      })
    },
  })
}

export function useCreateTema() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: TemaFormInput) => {
      await postJson('/api/decoracao/temas', 'POST', input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decoracao', 'temas'] })
      queryClient.invalidateQueries({ queryKey: ['decoracao', 'tema-receita'] })
      toast.success('Tema criado.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateTema() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: TemaFormInput }) => {
      await postJson(`/api/decoracao/temas/${id}`, 'PATCH', input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decoracao', 'temas'] })
      queryClient.invalidateQueries({ queryKey: ['decoracao', 'tema-receita'] })
      toast.success('Tema atualizado.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteTema() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await postJson(`/api/decoracao/temas/${id}`, 'DELETE')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decoracao', 'temas'] })
      toast.success('Tema excluído.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ── Receita do tema (Bloco B) ────────────────────────────────

/**
 * Catálogo achatado de variações de itens ATIVOS — alimenta o seletor
 * "Adicionar variação…" da receita do tema.
 */
export function useDecoracaoVariacoesCatalog() {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  return useQuery({
    queryKey: ['decoracao', 'variacoes-catalogo'],
    enabled: isSessionReady,
    staleTime: 5 * 60 * 1000,
    retry,
    queryFn: async (): Promise<VariacaoCatalogo[]> => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('decoracao_item_variacoes')
        .select(
          `
          id, codigo, tamanho, cor, detalhe,
          item:decoracao_itens(nome, ativo)
          `,
        )
      if (error) throw error

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((data ?? []) as any[])
        .filter((row) => row.item?.ativo)
        .map((row) => ({
          variacao_id: row.id as string,
          codigo: (row.codigo ?? '—') as string,
          tamanho: (row.tamanho ?? null) as string | null,
          cor: (row.cor ?? null) as string | null,
          detalhe: (row.detalhe ?? null) as string | null,
          item_nome: (row.item?.nome ?? '—') as string,
        }))
        .sort((a, b) => {
          const an = a.item_nome.localeCompare(b.item_nome, 'pt-BR')
          return an !== 0 ? an : a.codigo.localeCompare(b.codigo)
        })
    },
  })
}

/**
 * Receita de um tema (lazy — só quando o sheet abre em modo edição).
 * Retorna as linhas já hidratadas com variação + item + código.
 */
export function useTemaReceita(temaId: string | null) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  return useQuery({
    queryKey: ['decoracao', 'tema-receita', temaId],
    enabled: isSessionReady && !!temaId,
    staleTime: 0,
    retry,
    queryFn: async (): Promise<TemaReceitaLinha[]> => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('decoracao_tema_itens')
        .select(
          `
          variacao_id, quantidade, ordem,
          variacao:decoracao_item_variacoes(
            codigo, tamanho, cor, detalhe,
            item:decoracao_itens(nome)
          )
          `,
        )
        .eq('tema_id', temaId!)
        .order('ordem')
      if (error) throw error

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((data ?? []) as any[]).map((row) => ({
        variacao_id: row.variacao_id as string,
        quantidade: row.quantidade as number,
        ordem: row.ordem as number,
        codigo: (row.variacao?.codigo ?? '—') as string,
        tamanho: (row.variacao?.tamanho ?? null) as string | null,
        cor: (row.variacao?.cor ?? null) as string | null,
        detalhe: (row.variacao?.detalhe ?? null) as string | null,
        item_nome: (row.variacao?.item?.nome ?? '—') as string,
      }))
    },
  })
}

// ── Decoração da festa (Bloco C — festa puxa o tema) ─────────

/**
 * Decoração de uma festa (por event_id). Lazy — só quando a seção abre.
 * Retorna null se a festa ainda não tem decoração vinculada.
 * A lista vem hidratada (variação + item + código); `tema_foto_url` é a
 * foto modelo do tema, `foto_path` é o override da festa (se houver).
 */
export function useFestaDecoracao(eventId: string | null) {
  const isSessionReady = useAuthReadyStore((s: { isSessionReady: boolean }) => s.isSessionReady)
  return useQuery({
    queryKey: ['decoracao', 'festa', eventId],
    enabled: isSessionReady && !!eventId,
    staleTime: 0,
    retry,
    queryFn: async (): Promise<FestaDecoracaoCompleta | null> => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('decoracao_festa')
        .select(
          `
          id, event_id, tema_id, foto_path, observacoes,
          tema:decoracao_temas(nome, foto_url),
          itens:decoracao_festa_itens(
            variacao_id, quantidade, ordem,
            variacao:decoracao_item_variacoes(
              codigo, tamanho, cor, detalhe,
              item:decoracao_itens(nome)
            )
          )
          `,
        )
        .eq('event_id', eventId!)
        .maybeSingle()
      if (error) throw error
      if (!data) return null

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itens: FestaItemLinha[] = ((data.itens ?? []) as any[])
        .map((row) => ({
          variacao_id: row.variacao_id as string,
          quantidade: row.quantidade as number,
          ordem: row.ordem as number,
          codigo: (row.variacao?.codigo ?? '—') as string,
          tamanho: (row.variacao?.tamanho ?? null) as string | null,
          cor: (row.variacao?.cor ?? null) as string | null,
          detalhe: (row.variacao?.detalhe ?? null) as string | null,
          item_nome: (row.variacao?.item?.nome ?? '—') as string,
        }))
        .sort((a, b) => a.ordem - b.ordem)

      return {
        id: data.id as string,
        event_id: data.event_id as string,
        tema_id: (data.tema_id ?? null) as string | null,
        tema_nome: (data.tema?.nome ?? null) as string | null,
        tema_foto_url: (data.tema?.foto_url ?? null) as string | null,
        foto_path: (data.foto_path ?? null) as string | null,
        observacoes: (data.observacoes ?? null) as string | null,
        itens,
      }
    },
  })
}

/** Vincula um tema à festa — puxa (copia) a receita do tema como lista. */
export function useVincularTema() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ eventId, temaId }: { eventId: string; temaId: string }) => {
      await postJson('/api/decoracao/festa/vincular', 'POST', {
        event_id: eventId,
        tema_id: temaId,
      })
    },
    onSuccess: (_data, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['decoracao', 'festa', eventId] })
      toast.success('Tema vinculado — receita puxada para a festa.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

/** Atualiza a decoração da festa: lista de itens, foto override e/ou observações. */
export function useUpdateFestaDecoracao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      eventId: _eventId,
      itens,
      foto_path,
      observacoes,
    }: {
      id: string
      eventId: string
      itens?: FestaItemInput[]
      foto_path?: string | null
      observacoes?: string | null
    }) => {
      const body: Record<string, unknown> = {}
      if (itens !== undefined) body.itens = itens
      if (foto_path !== undefined) body.foto_path = foto_path
      if (observacoes !== undefined) body.observacoes = observacoes
      await postJson(`/api/decoracao/festa/${id}`, 'PATCH', body)
    },
    onSuccess: (_data, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['decoracao', 'festa', eventId] })
      toast.success('Decoração da festa atualizada.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

/** Remove a decoração inteira da festa (desvincular). */
export function useDeleteFestaDecoracao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, eventId: _eventId }: { id: string; eventId: string }) => {
      await postJson(`/api/decoracao/festa/${id}`, 'DELETE')
    },
    onSuccess: (_data, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['decoracao', 'festa', eventId] })
      toast.success('Decoração removida da festa.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ── Balões ───────────────────────────────────────────────────

export function useBalaoModelos() {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  return useQuery({
    queryKey: ['decoracao', 'baloes'],
    enabled: isSessionReady,
    staleTime: 5 * 60 * 1000,
    retry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('decoracao_balao_modelos')
        .select('*')
        .order('nome')
      if (error) throw error
      return (data ?? []) as DecoracaoBalaoModelo[]
    },
  })
}

export function useCreateBalaoModelo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: BalaoModeloFormInput) => {
      await postJson('/api/decoracao/baloes', 'POST', input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decoracao', 'baloes'] })
      toast.success('Modelo de balão criado.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateBalaoModelo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: BalaoModeloFormInput }) => {
      await postJson(`/api/decoracao/baloes/${id}`, 'PATCH', input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decoracao', 'baloes'] })
      toast.success('Modelo atualizado.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteBalaoModelo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await postJson(`/api/decoracao/baloes/${id}`, 'DELETE')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decoracao', 'baloes'] })
      toast.success('Modelo excluído.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

