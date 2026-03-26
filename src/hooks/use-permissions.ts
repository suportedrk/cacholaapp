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

      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId)

      if (error) throw error

      // Converte para mapa module → action → granted
      const map: Partial<PermissionMap> = {}
      for (const perm of data as UserPermission[]) {
        if (!map[perm.module as Module]) {
          map[perm.module as Module] = {} as Record<Action, boolean>
        }
        ;(map[perm.module as Module] as Record<Action, boolean>)[perm.action as Action] =
          perm.granted
      }

      return map as PermissionMap
    },
    enabled: !!userId,
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
