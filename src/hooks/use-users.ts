'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { User, UserUpdate } from '@/types/database.types'
import type { UserRole } from '@/types/database.types'
import { toast } from 'sonner'
import { useAuthReadyStore } from '@/stores/auth-store'

const supabase = createClient()

// ─────────────────────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────────────────────

export function useUsers(filters?: { role?: UserRole; isActive?: boolean; search?: string }) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  return useQuery({
    queryKey: ['users', filters],
    enabled: isSessionReady,
    queryFn: async () => {
      // Omite `preferences` (JSONB grande) — não necessário em listas
      let query = supabase
        .from('users')
        .select('id, name, email, role, avatar_url, is_active, phone')
        .order('name')

      if (filters?.role) query = query.eq('role', filters.role)
      if (filters?.isActive !== undefined) query = query.eq('is_active', filters.isActive)
      if (filters?.search) {
        query = query.or(
          `name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
        )
      }

      const { data, error } = await query
      if (error) throw error
      return data as User[]
    },
    staleTime: 30 * 1000,
  })
}

export function useUser(id: string | null | undefined) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('users')
        .select('*') // detalhe: precisa de preferences para a página de perfil
        .eq('id', id)
        .single()
      if (error) throw error
      return data as User
    },
    enabled: !!id,
    staleTime: 30 * 1000,
  })
}

// ─────────────────────────────────────────────────────────────
// MUTATIONS
// ─────────────────────────────────────────────────────────────

export function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UserUpdate }) => {
      const { error } = await supabase.from('users').update(data).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['users', id] })
      toast.success('Usuário atualizado com sucesso')
    },
    onError: () => {
      toast.error('Erro ao atualizar usuário. Tente novamente.')
    },
  })
}

export function useDeactivateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('users')
        .update({ is_active: false })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Usuário desativado')
    },
    onError: () => {
      toast.error('Erro ao desativar usuário.')
    },
  })
}

export function useReactivateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('users')
        .update({ is_active: true })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Usuário reativado')
    },
    onError: () => {
      toast.error('Erro ao reativar usuário.')
    },
  })
}

// ─────────────────────────────────────────────────────────────
// CONVITES PENDENTES
// ─────────────────────────────────────────────────────────────

/**
 * Retorna um Set com os IDs de usuários que ainda não confirmaram o e-mail
 * (convite enviado mas não aceito). Chama GET /api/admin/users/pending-invites.
 */
export function usePendingInvites() {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['users', 'pending-invites'],
    enabled: isSessionReady,
    queryFn: async () => {
      const res = await fetch('/api/admin/users/pending-invites')
      if (!res.ok) throw new Error('Falha ao buscar convites pendentes')
      const data = await res.json() as { pendingIds: string[] }
      return new Set(data.pendingIds)
    },
    staleTime: 60 * 1000, // 1 min — convites não mudam com frequência
    retry: (count, err) => count < 2 && (err as { status?: number })?.status !== 401,
  })
}

/**
 * Reenvia o e-mail de convite para um usuário com confirmação pendente.
 * Chama POST /api/admin/resend-invite.
 */
export function useResendInvite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch('/api/admin/resend-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Erro ao reenviar convite')
      }
    },
    onSuccess: () => {
      // Invalida a lista de pendentes para refletir se o convite foi aceito
      queryClient.invalidateQueries({ queryKey: ['users', 'pending-invites'] })
      toast.success('Convite reenviado com sucesso!')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}
