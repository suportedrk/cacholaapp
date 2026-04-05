'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Unit, UserUnit, UserUnitWithUnit, UserRole } from '@/types/database.types'
import { useAuthReadyStore } from '@/stores/auth-store'
import { useUnitStore } from '@/stores/unit-store'

// ─────────────────────────────────────────────────────────────
// LISTAR TODAS AS UNIDADES (para admin)
// ─────────────────────────────────────────────────────────────
export function useUnits() {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  return useQuery({
    queryKey: ['units'],
    enabled: isSessionReady,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .order('name')
      if (error) throw error
      return (data ?? []) as Unit[]
    },
    staleTime: 5 * 60 * 1000, // unidades raramente mudam
  })
}

// ─────────────────────────────────────────────────────────────
// UNIDADE ÚNICA
// ─────────────────────────────────────────────────────────────
export function useUnit(id: string) {
  return useQuery({
    queryKey: ['units', id],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Unit
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}

// ─────────────────────────────────────────────────────────────
// UNIDADES DO USUÁRIO LOGADO (com dados da unidade)
// ─────────────────────────────────────────────────────────────
export function useMyUnits(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-units', userId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('user_units')
        .select(`
          *,
          unit:units(id, name, slug, is_active)
        `)
        .eq('user_id', userId!)
        .order('is_default', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as UserUnitWithUnit[]
    },
    enabled: !!userId,
  })
}

// ─────────────────────────────────────────────────────────────
// UNIDADES DE UM USUÁRIO ESPECÍFICO (para admin)
// ─────────────────────────────────────────────────────────────
export function useUserUnits(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-units', 'user', userId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('user_units')
        .select(`
          *,
          unit:units(id, name, slug, is_active)
        `)
        .eq('user_id', userId!)
      if (error) throw error
      return (data ?? []) as unknown as UserUnitWithUnit[]
    },
    enabled: !!userId,
  })
}

// ─────────────────────────────────────────────────────────────
// USUÁRIOS DE UMA UNIDADE ESPECÍFICA (para admin de unidade)
// ─────────────────────────────────────────────────────────────
export function useUnitUsers(unitId: string | undefined) {
  return useQuery({
    queryKey: ['user-units', 'unit', unitId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('user_units')
        .select(`
          *,
          user:users(id, name, email, avatar_url, is_active)
        `)
        .eq('unit_id', unitId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as (UserUnit & { user: { id: string; name: string; email: string; avatar_url: string | null; is_active: boolean } })[]
    },
    enabled: !!unitId,
  })
}

// ─────────────────────────────────────────────────────────────
// CRIAR UNIDADE
// ─────────────────────────────────────────────────────────────
export function useCreateUnit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      name: string
      slug: string
      address?: string | null
      phone?: string | null
    }) => {
      const res = await fetch('/api/admin/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao criar unidade.')
      return json.unit as Unit
    },
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ['units'] })
      toast.success('Unidade criada com sucesso!')

      // Atualiza userUnits no Zustand para que o UnitSwitcher mostre a nova unidade
      // sem exigir logout/login do usuário
      const userId = useAuthReadyStore.getState().user?.id
      if (userId) {
        const supabase = createClient()
        const { data } = await supabase
          .from('user_units')
          .select('*, unit:units(id, name, slug, is_active)')
          .eq('user_id', userId)
          .order('is_default', { ascending: false })
        if (data) {
          useUnitStore.getState().setUserUnits(data as unknown as UserUnitWithUnit[])
        }
      }
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─────────────────────────────────────────────────────────────
// ATUALIZAR UNIDADE
// ─────────────────────────────────────────────────────────────
export function useUpdateUnit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: {
      id: string
      data: Partial<Pick<Unit, 'name' | 'slug' | 'address' | 'phone' | 'is_active'>>
    }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('units')
        .update(data)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['units'] })
      qc.invalidateQueries({ queryKey: ['units', id] })
      toast.success('Unidade atualizada!')
    },
    onError: () => toast.error('Erro ao atualizar unidade.'),
  })
}

// ─────────────────────────────────────────────────────────────
// DESATIVAR UNIDADE (soft delete)
// ─────────────────────────────────────────────────────────────
export function useDeactivateUnit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('units')
        .update({ is_active: false })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['units'] })
      toast.success('Unidade desativada.')
    },
    onError: () => toast.error('Erro ao desativar unidade.'),
  })
}

// ─────────────────────────────────────────────────────────────
// VINCULAR USUÁRIO À UNIDADE
// ─────────────────────────────────────────────────────────────
export function useAddUserToUnit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      userId: string
      unitId: string
      role: UserRole
      isDefault?: boolean
    }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('user_units')
        .insert({
          user_id:    data.userId,
          unit_id:    data.unitId,
          role:       data.role,
          is_default: data.isDefault ?? false,
        })
      if (error) throw error
    },
    onSuccess: (_, { userId }) => {
      qc.invalidateQueries({ queryKey: ['user-units'] })
      qc.invalidateQueries({ queryKey: ['user-units', 'user', userId] })
      toast.success('Usuário vinculado à unidade!')
    },
    onError: () => toast.error('Erro ao vincular usuário.'),
  })
}

// ─────────────────────────────────────────────────────────────
// ATUALIZAR ROLE DO USUÁRIO NA UNIDADE
// ─────────────────────────────────────────────────────────────
export function useUpdateUserUnitRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      id: string          // user_units.id
      userId: string
      role: UserRole
      isDefault?: boolean
    }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('user_units')
        .update({ role: data.role, ...(data.isDefault !== undefined && { is_default: data.isDefault }) })
        .eq('id', data.id)
      if (error) throw error
    },
    onSuccess: (_, { userId }) => {
      qc.invalidateQueries({ queryKey: ['user-units'] })
      qc.invalidateQueries({ queryKey: ['user-units', 'user', userId] })
      toast.success('Papel atualizado!')
    },
    onError: () => toast.error('Erro ao atualizar papel.'),
  })
}

// ─────────────────────────────────────────────────────────────
// REMOVER USUÁRIO DA UNIDADE
// ─────────────────────────────────────────────────────────────
export function useRemoveUserFromUnit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('user_units')
        .delete()
        .eq('id', id)
      if (error) throw error
      return userId
    },
    onSuccess: (userId) => {
      qc.invalidateQueries({ queryKey: ['user-units'] })
      qc.invalidateQueries({ queryKey: ['user-units', 'user', userId] })
      toast.success('Vínculo removido.')
    },
    onError: () => toast.error('Erro ao remover vínculo.'),
  })
}

// ─────────────────────────────────────────────────────────────
// DEFINIR UNIDADE PADRÃO DO USUÁRIO
// ─────────────────────────────────────────────────────────────
export function useSetDefaultUnit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, unitId }: { userId: string; unitId: string }) => {
      const supabase = createClient()
      // 1. Desmarcar todas as unidades do usuário como padrão
      await supabase
        .from('user_units')
        .update({ is_default: false })
        .eq('user_id', userId)
      // 2. Marcar a selecionada como padrão
      const { error } = await supabase
        .from('user_units')
        .update({ is_default: true })
        .eq('user_id', userId)
        .eq('unit_id', unitId)
      if (error) throw error
    },
    onSuccess: (_, { userId }) => {
      qc.invalidateQueries({ queryKey: ['user-units', 'user', userId] })
      toast.success('Unidade padrão definida!')
    },
    onError: () => toast.error('Erro ao definir unidade padrão.'),
  })
}
