'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'
import { useAuth } from '@/hooks/use-auth'

// ─────────────────────────────────────────────────────────────
// PERMISSÕES DE ATAS (via check_permission no banco)
//
// Retorna as 3 permissões de escrita do módulo 'atas' (create/edit/delete)
// resolvidas em paralelo numa única query. Espelha o padrão de
// useEquipmentDeletePermission. O gating fino por linha (criador / diretoria /
// participante / ata geral) é aplicado nas páginas que consomem este hook,
// alinhado às policies RLS da migration 153.
// ─────────────────────────────────────────────────────────────

interface AtasPermissions {
  canCreate: boolean
  canEdit:   boolean
  canDelete: boolean
  /** true enquanto a permissão ainda não tem resposta definitiva. */
  isLoading: boolean
}

interface AtasPermissionsData {
  create: boolean
  edit:   boolean
  delete: boolean
}

export function useAtasPermissions(): AtasPermissions {
  const isSessionReady = useAuthReadyStore((s: { isSessionReady: boolean }) => s.isSessionReady)
  const { profile } = useAuth()
  const userId = profile?.id

  const query = useQuery<AtasPermissionsData>({
    queryKey: ['atas-permissions', userId],
    enabled: isSessionReady && !!userId,
    staleTime: 5 * 60 * 1000,
    retry: (count, err: unknown) => {
      const status = (err as { status?: number; code?: number })?.status
        ?? (err as { status?: number; code?: number })?.code
      if (status === 401 || status === 403) return false
      return count < 2
    },
    queryFn: async () => {
      const supabase = createClient()

      const [create, edit, del] = await Promise.all([
        supabase.rpc('check_permission', { p_user_id: userId!, p_module: 'atas', p_action: 'create' }),
        supabase.rpc('check_permission', { p_user_id: userId!, p_module: 'atas', p_action: 'edit' }),
        supabase.rpc('check_permission', { p_user_id: userId!, p_module: 'atas', p_action: 'delete' }),
      ])

      if (create.error) throw create.error
      if (edit.error)   throw edit.error
      if (del.error)    throw del.error

      return {
        create: create.data === true,
        edit:   edit.data === true,
        delete: del.data === true,
      }
    },
  })

  return {
    canCreate: query.data?.create ?? false,
    canEdit:   query.data?.edit   ?? false,
    canDelete: query.data?.delete ?? false,
    // isPending = ainda sem resposta (inclui o estado disabled antes da sessão).
    // Usado para evitar redirect/flicker prematuro nas páginas consumidoras.
    isLoading: query.isPending,
  }
}
