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
