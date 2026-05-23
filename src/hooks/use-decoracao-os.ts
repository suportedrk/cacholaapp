'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'
import type {
  DecoracaoOSComItens,
  DecoracaoOSFormInput,
  DecoracaoOSItemComModelo,
  EventSummaryForOS,
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

/** Lista todas as OS visíveis (RLS já filtra por unidade). */
export function useDecoracaoOS() {
  const isSessionReady = useAuthReadyStore((s: { isSessionReady: boolean }) => s.isSessionReady)
  return useQuery({
    queryKey: ['decoracao', 'os'],
    enabled: isSessionReady,
    staleTime: 60 * 1000,
    retry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('decoracao_os')
        .select(
          '*, itens:decoracao_os_itens(*, modelo:decoracao_balao_modelos(id, nome, custo, valor_venda))',
        )
        .order('data_festa', { ascending: true, nullsFirst: false })
        .order('hora_festa', { ascending: true, nullsFirst: false })
      if (error) throw error

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((data ?? []) as any[]).map((row): DecoracaoOSComItens => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const itensRaw = (row.itens ?? []) as any[]
        const itens = itensRaw
          .map(
            (i): DecoracaoOSItemComModelo => ({
              id: i.id,
              os_id: i.os_id,
              balao_modelo_id: i.balao_modelo_id,
              quantidade: i.quantidade,
              observacoes: i.observacoes,
              status: i.status,
              ordem: i.ordem,
              created_at: i.created_at,
              updated_at: i.updated_at,
              modelo: i.modelo
                ? {
                    id: i.modelo.id,
                    nome: i.modelo.nome,
                    custo: i.modelo.custo,
                    valor_venda: i.modelo.valor_venda,
                  }
                : null,
            }),
          )
          .sort((a, b) => a.ordem - b.ordem)
        const { itens: _drop, ...header } = row
        void _drop
        return { ...header, itens }
      })
    },
  })
}

/** Detalhe de uma OS (com itens + modelos hidratados). */
export function useDecoracaoOSDetail(id: string | undefined) {
  const isSessionReady = useAuthReadyStore((s: { isSessionReady: boolean }) => s.isSessionReady)
  return useQuery({
    queryKey: ['decoracao', 'os', id],
    enabled: isSessionReady && !!id,
    staleTime: 60 * 1000,
    retry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('decoracao_os')
        .select(
          '*, itens:decoracao_os_itens(*, modelo:decoracao_balao_modelos(id, nome, custo, valor_venda))',
        )
        .eq('id', id)
        .single()
      if (error) throw error

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itensRaw = (data.itens ?? []) as any[]
      const itens = itensRaw
        .map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (i: any): DecoracaoOSItemComModelo => ({
            id: i.id,
            os_id: i.os_id,
            balao_modelo_id: i.balao_modelo_id,
            quantidade: i.quantidade,
            observacoes: i.observacoes,
            status: i.status,
            ordem: i.ordem,
            created_at: i.created_at,
            updated_at: i.updated_at,
            modelo: i.modelo
              ? {
                  id: i.modelo.id,
                  nome: i.modelo.nome,
                  custo: i.modelo.custo,
                  valor_venda: i.modelo.valor_venda,
                }
              : null,
          }),
        )
        .sort((a, b) => a.ordem - b.ordem)
      const { itens: _drop, ...header } = data
      void _drop
      return { ...header, itens } as DecoracaoOSComItens
    },
  })
}

/** Carrega um evento específico pelo ID — usado para exibir o vínculo em modo edit. */
export function useEventForOSLink(eventId: string | null | undefined) {
  const isSessionReady = useAuthReadyStore((s: { isSessionReady: boolean }) => s.isSessionReady)
  return useQuery({
    queryKey: ['decoracao', 'event-for-os-link', eventId],
    enabled: isSessionReady && !!eventId,
    staleTime: 5 * 60 * 1000,
    retry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('events')
        .select('id, date, start_time, end_time, client_name, birthday_person, theme, status, unit_id, units!events_unit_id_fkey(slug)')
        .eq('id', eventId)
        .single()
      if (error) throw error
      return {
        id: data.id,
        date: data.date,
        start_time: data.start_time,
        end_time: data.end_time,
        client_name: data.client_name,
        birthday_person: data.birthday_person,
        theme: data.theme,
        status: data.status,
        unit_id: data.unit_id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        unit_slug: (data as any).units?.slug ?? null,
      } as EventSummaryForOS
    },
  })
}

/** Busca festas para vincular a uma OS. Janela padrão: -30 a +90 dias. */
export function useEventsForLink(params: { search?: string } = {}) {
  const isSessionReady = useAuthReadyStore((s: { isSessionReady: boolean }) => s.isSessionReady)
  const { search = '' } = params
  return useQuery({
    queryKey: ['decoracao', 'events-for-link', search],
    enabled: isSessionReady,
    staleTime: 30 * 1000,
    retry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('search_events_for_os_link', {
        p_search: search || null,
        p_date_from: null,
        p_date_to: null,
      })
      if (error) throw error
      return (data ?? []) as EventSummaryForOS[]
    },
  })
}

/** Conta quantas OS já estão vinculadas a uma festa (para aviso de duplicata). */
export function useOSCountForEvent(eventId: string | null) {
  const isSessionReady = useAuthReadyStore((s: { isSessionReady: boolean }) => s.isSessionReady)
  return useQuery({
    queryKey: ['decoracao', 'os-count-for-event', eventId],
    enabled: isSessionReady && !!eventId,
    staleTime: 30 * 1000,
    retry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_os_count_for_event', {
        p_event_id: eventId,
      })
      if (error) throw error
      return (data as number) ?? 0
    },
  })
}

export function useCreateDecoracaoOS() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: DecoracaoOSFormInput) => {
      const res = await callJson('/api/decoracao/ordens', 'POST', input)
      return res?.data?.id as string
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decoracao', 'os'] })
      toast.success('Ordem criada.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateDecoracaoOS() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: DecoracaoOSFormInput }) => {
      await callJson(`/api/decoracao/ordens/${id}`, 'PATCH', input)
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['decoracao', 'os'] })
      queryClient.invalidateQueries({ queryKey: ['decoracao', 'os', vars.id] })
      toast.success('Ordem atualizada.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteDecoracaoOS() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await callJson(`/api/decoracao/ordens/${id}`, 'DELETE')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decoracao', 'os'] })
      toast.success('Ordem excluída.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
