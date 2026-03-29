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
