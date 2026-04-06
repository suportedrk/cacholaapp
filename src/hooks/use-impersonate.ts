'use client'

import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useImpersonateStore } from '@/stores/impersonate-store'

/**
 * Hook para iniciar o modo "Ver como".
 *
 * Uso:
 *   const { mutate: startViewAs, isPending } = useStartImpersonate()
 *   startViewAs(userId)
 */
export function useStartImpersonate() {
  const { startImpersonating } = useImpersonateStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/admin/impersonate?userId=${userId}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || 'Falha ao carregar dados do usuário.')
      }
      return res.json()
    },
    onSuccess: (data) => {
      startImpersonating({
        profile: data.profile,
        userUnits: data.userUnits,
        permissions: data.permissions,
      })
      // Invalida todas as queries para recarregar com o novo contexto
      queryClient.invalidateQueries()
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao ativar "Ver como".')
    },
  })
}

/**
 * Hook para encerrar o modo "Ver como" e voltar ao contexto original.
 *
 * Uso:
 *   const stopViewAs = useStopImpersonate()
 *   stopViewAs()
 */
export function useStopImpersonate() {
  const { stopImpersonating } = useImpersonateStore()
  const queryClient = useQueryClient()

  return useCallback(() => {
    stopImpersonating()
    // Invalida todas as queries para recarregar com o contexto real do admin
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
