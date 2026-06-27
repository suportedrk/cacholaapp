'use client'

import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useImpersonateStore } from '@/stores/impersonate-store'

const ENDPOINT = '/api/admin/impersonate'

/**
 * Inicia o modo "Ver como" (impersonation 2A).
 * POST minta o JWT do alvo + seta o cookie httpOnly; a resposta traz o token (usado pelo
 * client de dados) + profile/userUnits/permissions (menu/banner).
 */
export function useStartImpersonate() {
  const { startImpersonating } = useImpersonateStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || 'Falha ao iniciar o modo "Ver como".')
      }
      return res.json()
    },
    onSuccess: (data) => {
      startImpersonating({
        token: data.token,
        profile: data.profile,
        userUnits: data.userUnits,
        permissions: data.permissions,
      })
      // Recarrega todas as queries com o contexto (token) do alvo.
      queryClient.invalidateQueries()
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao ativar "Ver como".')
    },
  })
}

/**
 * Encerra o modo "Ver como". Limpa o cookie no servidor (DELETE) ANTES de limpar a store —
 * sem isso o cookie httpOnly sobreviveria e os guards SSR continuariam avaliando o cargo do
 * alvo (divergência client/server). Depois invalida as queries para voltar ao contexto real.
 */
export function useStopImpersonate() {
  const { stopImpersonating } = useImpersonateStore()
  const queryClient = useQueryClient()

  return useCallback(async () => {
    try {
      await fetch(ENDPOINT, { method: 'DELETE' })
    } catch {
      // Mesmo se a limpeza do cookie falhar, encerra o estado client-side; o cookie
      // expira sozinho (TTL) e a re-hidratação no boot só ocorre se ele ainda for válido.
    }
    stopImpersonating()
    queryClient.invalidateQueries()
  }, [stopImpersonating, queryClient])
}

/** Lê estado atual do impersonate (útil para componentes que só precisam saber se está ativo). */
export function useImpersonateState() {
  return useImpersonateStore((s) => ({
    isImpersonating: s.isImpersonating,
    impersonatedProfile: s.impersonatedProfile,
  }))
}
