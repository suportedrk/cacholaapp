'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { UserPermission } from '@/types/database.types'
import type { PermissionMap, Module, Action } from '@/types/permissions'
import { toast } from 'sonner'

const supabase = createClient()

export function useUserPermissions(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['permissions', userId],
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
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // permissões raramente mudam — revalida a cada 5min
  })
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
