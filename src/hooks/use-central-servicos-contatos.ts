'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'
import type {
  CentralServicosContato,
  ContatoFormInput,
  GrupoMembro,
} from '@/types/central-servicos'

const MEMBRO_FIELDS =
  'id,nome,tipo,setor,cargo,unidade,email,telefone,foto_path,ativo,ordem,created_at,updated_at,created_by'

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

/**
 * Lista de contatos. A visibilidade de inativos é controlada pela RLS da tabela:
 * quem só tem `view` recebe apenas ativos; quem tem `edit` recebe também os
 * inativos (esmaecidos no UI). Por isso o hook NÃO filtra `ativo` no cliente.
 */
export function useCentralServicosContatos() {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['central-servicos', 'contatos'],
    enabled: isSessionReady,
    staleTime: 60 * 1000,
    retry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('central_servicos_contatos')
        .select('*')
        .order('ativo', { ascending: false })
        .order('ordem', { ascending: true })
        .order('nome', { ascending: true })

      if (error) throw error
      return (data ?? []) as CentralServicosContato[]
    },
  })
}

/**
 * Membros ("quem recebe") de um grupo. Monta a lista por JOIN à tabela de
 * contatos (membro) com `!inner` — assim a RLS reforçada do C1 esconde
 * automaticamente membros INATIVOS de quem só tem view, e a RLS da tabela de
 * membros esconde tudo se o próprio grupo estiver inativo.
 */
export function useGrupoMembros(grupoId: string | null, enabled = true) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['central-servicos', 'grupo-membros', grupoId],
    enabled: isSessionReady && !!grupoId && enabled,
    staleTime: 60 * 1000,
    retry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('central_servicos_grupo_membros')
        .select(`id, membro:membro_id!inner(${MEMBRO_FIELDS})`)
        .eq('grupo_id', grupoId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data ?? []) as GrupoMembro[]
    },
  })
}

export function useAddMembro() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ grupoId, membroId }: { grupoId: string; membroId: string }) => {
      await callJson(`/api/central-servicos/contatos/${grupoId}/membros`, 'POST', {
        membro_id: membroId,
      })
    },
    onSuccess: (_d, { grupoId }) => {
      queryClient.invalidateQueries({ queryKey: ['central-servicos', 'grupo-membros', grupoId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useRemoveMembro() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ grupoId, membroId }: { grupoId: string; membroId: string }) => {
      await callJson(`/api/central-servicos/contatos/${grupoId}/membros/${membroId}`, 'DELETE')
    },
    onSuccess: (_d, { grupoId }) => {
      queryClient.invalidateQueries({ queryKey: ['central-servicos', 'grupo-membros', grupoId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

/**
 * Quantidade de vínculos de um contato em grupos (como grupo-com-membros OU
 * como pessoa-membro). > 0 bloqueia a troca de `tipo` (invariante grupo×pessoa).
 */
export function useContatoVinculosCount(contatoId: string | null, enabled = true) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['central-servicos', 'contato-vinculos', contatoId],
    enabled: isSessionReady && !!contatoId && enabled,
    staleTime: 60 * 1000,
    retry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count, error } = await (supabase as any)
        .from('central_servicos_grupo_membros')
        .select('id', { count: 'exact', head: true })
        .or(`grupo_id.eq.${contatoId},membro_id.eq.${contatoId}`)
      if (error) throw error
      return (count ?? 0) as number
    },
  })
}

export function useCreateContato() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ContatoFormInput) => {
      const res = await callJson('/api/central-servicos/contatos', 'POST', input)
      return res?.data?.id as string
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['central-servicos', 'contatos'] })
      toast.success('Contato criado.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateContato() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ContatoFormInput }) => {
      await callJson(`/api/central-servicos/contatos/${id}`, 'PATCH', input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['central-servicos', 'contatos'] })
      toast.success('Contato atualizado.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteContato() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await callJson(`/api/central-servicos/contatos/${id}`, 'DELETE')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['central-servicos', 'contatos'] })
      toast.success('Contato excluído.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
