'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { UserPermission } from '@/types/database.types'
import type { PermissionMap, Module, Action } from '@/types/permissions'
import { toast } from 'sonner'
import { useAuthReadyStore } from '@/stores/auth-store'
import { useImpersonateStore } from '@/stores/impersonate-store'

const supabase = createClient()

export function useUserPermissions(userId: string | null | undefined) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  // Impersonate: quando o userId pedido é o do usuário impersonado, retornar
  // as permissões já resolvidas pela API (evita query com RLS do admin real,
  // que retornaria dados errados ou vazios para o userId do impersonado).
  const { isImpersonating, impersonatedProfile, impersonatedPermissions } = useImpersonateStore()
  const isForImpersonated = isImpersonating && !!userId && userId === impersonatedProfile?.id

  const query = useQuery({
    queryKey: ['permissions', userId],
    // Desabilita a query quando estamos servindo do store (regras de hooks: sempre chamado)
    enabled: !!userId && isSessionReady && !isForImpersonated,
    queryFn: async () => {
      if (!userId) return null

      // Seleciona apenas as 3 colunas usadas para montar o mapa — evita id/created_at/unit_id
      const { data, error } = await supabase
        .from('user_permissions')
        .select('module, action, granted')
        .eq('user_id', userId)

      if (error) throw error

      // Converte para mapa module → action → granted
      const map: Partial<PermissionMap> = {}
      for (const perm of data as Pick<UserPermission, 'module' | 'action' | 'granted'>[]) {
        if (!map[perm.module as Module]) {
          map[perm.module as Module] = {} as Record<Action, boolean>
        }
        ;(map[perm.module as Module] as Record<Action, boolean>)[perm.action as Action] =
          perm.granted
      }

      return map as PermissionMap
    },
    staleTime: 5 * 60 * 1000, // permissões raramente mudam — revalida a cada 5min
  })

  // Retornar permissões do store quando impersonando o usuário alvo
  if (isForImpersonated) {
    return {
      ...query,
      data: impersonatedPermissions,
      isLoading: false,
      isPending: false,
      isError: false,
      error: null,
    }
  }

  return query
}

export function useUpdatePermission() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      userId,
      module,
      action,
      granted,
    }: {
      userId: string
      module: Module
      action: Action
      granted: boolean
    }) => {
      const { error } = await supabase
        .from('user_permissions')
        .update({ granted })
        .eq('user_id', userId)
        .eq('module', module)
        .eq('action', action)

      if (error) throw error
    },
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['permissions', userId] })
    },
    onError: () => {
      toast.error('Erro ao atualizar permissão.')
    },
  })
}
