'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { EventType, Package, Venue } from '@/types/database.types'
import { toast } from 'sonner'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'

// ─────────────────────────────────────────────────────────────
// EVENT TYPES
// ─────────────────────────────────────────────────────────────
export function useEventTypes(onlyActive = true) {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  return useQuery({
    queryKey: ['event-types', { onlyActive }, activeUnitId],
    enabled: isSessionReady,
    queryFn: async () => {
      const supabase = createClient()
      let query = supabase
        .from('event_types')
        .select('*')
        .order('sort_order', { ascending: true })
      if (activeUnitId) query = query.eq('unit_id', activeUnitId)
      if (onlyActive) query = query.eq('is_active', true)
      const { data, error } = await query
      if (error) throw error
      return data as EventType[]
    },
    staleTime: 5 * 60 * 1000, // 5 min — dados de config mudam pouco
  })
}

export function useCreateEventType() {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()
  return useMutation({
    mutationFn: async (data: { name: string; sort_order?: number }) => {
      const supabase = createClient()
      const { error } = await supabase.from('event_types').insert({ ...data, unit_id: activeUnitId! })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-types'] })
      toast.success('Tipo de evento criado.')
    },
    onError: () => toast.error('Erro ao criar tipo de evento.'),
  })
}

export function useUpdateEventType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EventType> }) => {
      const supabase = createClient()
      const { error } = await supabase.from('event_types').update(data).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-types'] })
      toast.success('Tipo de evento atualizado.')
    },
    onError: () => toast.error('Erro ao atualizar tipo de evento.'),
  })
}

export function useDeleteEventType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('event_types').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-types'] })
      toast.success('Tipo de evento removido.')
    },
    onError: () => toast.error('Erro ao remover tipo de evento. Pode estar em uso.'),
  })
}

// ─────────────────────────────────────────────────────────────
// PACKAGES
// ─────────────────────────────────────────────────────────────
export function usePackages(onlyActive = true) {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  return useQuery({
    queryKey: ['packages', { onlyActive }, activeUnitId],
    enabled: isSessionReady,
    queryFn: async () => {
      const supabase = createClient()
      let query = supabase
        .from('packages')
        .select('*')
        .order('sort_order', { ascending: true })
      if (activeUnitId) query = query.eq('unit_id', activeUnitId)
      if (onlyActive) query = query.eq('is_active', true)
      const { data, error } = await query
      if (error) throw error
      return data as Package[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreatePackage() {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()
  return useMutation({
    mutationFn: async (data: { name: string; description?: string; sort_order?: number }) => {
      const supabase = createClient()
      const { error } = await supabase.from('packages').insert({ ...data, unit_id: activeUnitId! })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages'] })
      toast.success('Pacote criado.')
    },
    onError: () => toast.error('Erro ao criar pacote.'),
  })
}

export function useUpdatePackage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Package> }) => {
      const supabase = createClient()
      const { error } = await supabase.from('packages').update(data).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages'] })
      toast.success('Pacote atualizado.')
    },
    onError: () => toast.error('Erro ao atualizar pacote.'),
  })
}

export function useDeletePackage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('packages').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages'] })
      toast.success('Pacote removido.')
    },
    onError: () => toast.error('Erro ao remover pacote. Pode estar em uso.'),
  })
}

// ─────────────────────────────────────────────────────────────
// VENUES
// ─────────────────────────────────────────────────────────────
export function useVenues(onlyActive = true) {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  return useQuery({
    queryKey: ['venues', { onlyActive }, activeUnitId],
    enabled: isSessionReady,
    queryFn: async () => {
      const supabase = createClient()
      let query = supabase
        .from('venues')
        .select('*')
        .order('sort_order', { ascending: true })
      if (activeUnitId) query = query.eq('unit_id', activeUnitId)
      if (onlyActive) query = query.eq('is_active', true)
      const { data, error } = await query
      if (error) throw error
      return data as Venue[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateVenue() {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()
  return useMutation({
    mutationFn: async (data: { name: string; capacity?: number; sort_order?: number }) => {
      const supabase = createClient()
      const { error } = await supabase.from('venues').insert({ ...data, unit_id: activeUnitId! })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['venues'] })
      toast.success('Salão criado.')
    },
    onError: () => toast.error('Erro ao criar salão.'),
  })
}

export function useUpdateVenue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Venue> }) => {
      const supabase = createClient()
      const { error } = await supabase.from('venues').update(data).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['venues'] })
      toast.success('Salão atualizado.')
    },
    onError: () => toast.error('Erro ao atualizar salão.'),
  })
}

export function useDeleteVenue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('venues').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['venues'] })
      toast.success('Salão removido.')
    },
    onError: () => toast.error('Erro ao remover salão. Pode estar em uso.'),
  })
}
