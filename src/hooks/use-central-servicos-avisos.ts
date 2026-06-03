'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'
import type { CentralServicosAviso, AvisoFormInput } from '@/types/central-servicos'

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
 * Lista de avisos. A vigência é controlada pela RLS: quem só tem `view` recebe
 * apenas avisos vigentes; quem tem `edit` recebe todos (futuros/expirados).
 * Ordenação final (prioridade alta primeiro) é feita no componente.
 */
export function useCentralServicosAvisos() {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['central-servicos', 'avisos'],
    enabled: isSessionReady,
    staleTime: 60 * 1000,
    retry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('central_servicos_avisos')
        .select('*')
        .order('publicado_em', { ascending: false })

      if (error) throw error
      return (data ?? []) as CentralServicosAviso[]
    },
  })
}

export function useCreateAviso() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: AvisoFormInput) => {
      const res = await callJson('/api/central-servicos/avisos', 'POST', input)
      return res?.data?.id as string
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['central-servicos', 'avisos'] })
      toast.success('Aviso publicado.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateAviso() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: AvisoFormInput }) => {
      await callJson(`/api/central-servicos/avisos/${id}`, 'PATCH', input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['central-servicos', 'avisos'] })
      toast.success('Aviso atualizado.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteAviso() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await callJson(`/api/central-servicos/avisos/${id}`, 'DELETE')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['central-servicos', 'avisos'] })
      toast.success('Aviso excluído.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
