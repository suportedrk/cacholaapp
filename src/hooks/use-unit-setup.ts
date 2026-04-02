'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Hook: useUnitSetup
// Queries e mutations para o wizard de setup de unidade.
// Acesso exclusivo: super_admin e diretor.
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthReadyStore } from '@/stores/auth-store'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UnitSetupStatus {
  unit: { id: string; name: string; slug: string; address: string | null; phone: string | null; is_active: boolean }
  hasBasicData: boolean
  hasPloomesMapping: boolean
  ploomesValue: string | null
  templateCounts: {
    checklistTemplates: number
    checklistCategories: number
    sectors: number
    equipmentCategories: number
    serviceCategories: number
  }
  teamCount: number
  providerCount: number
  dealCount: number
}

export interface CopyableData {
  checklistTemplates: Array<{ id: string; name: string; itemCount: number }>
  checklistCategories: Array<{ id: string; name: string }>
  sectors: Array<{ id: string; name: string }>
  equipmentCategories: Array<{ id: string; name: string }>
  serviceCategories: Array<{ id: string; name: string }>
}

export interface TeamMember {
  userId: string
  role: UserRole
  isDefault?: boolean
}

export interface CopyTemplatesPayload {
  sourceUnitId: string
  targetUnitId: string
  include?: {
    checklistTemplates?: boolean
    checklistCategories?: boolean
    sectors?: boolean
    equipmentCategories?: boolean
    serviceCategories?: boolean
  }
}

export interface FinalizeSetupPayload {
  unitId: string
  name?: string
  address?: string
  phone?: string
  ploomesUnitName?: string
  ploomesObjectId?: number
  triggerPloomeSync?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

/** Status de setup de uma unidade específica */
export function useUnitSetupStatus(unitId: string | null) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery<UnitSetupStatus>({
    queryKey: ['unit-setup-status', unitId],
    queryFn: async () => {
      const res = await fetch(`/api/units/${unitId}/setup-status`)
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao carregar status.')
      return res.json()
    },
    enabled: !!unitId && isSessionReady,
    staleTime: 30 * 1000,
    retry: (count, err) => count < 2 && (err as { status?: number })?.status !== 401 && (err as { status?: number })?.status !== 403,
  })
}

/** Dados copiáveis de uma unidade (para o Step 3) */
export function useCopyableData(sourceUnitId: string | null) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery<CopyableData>({
    queryKey: ['unit-copyable-data', sourceUnitId],
    queryFn: async () => {
      const res = await fetch(`/api/units/${sourceUnitId}/copyable-data`)
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao carregar dados copiáveis.')
      return res.json()
    },
    enabled: !!sourceUnitId && isSessionReady,
    staleTime: 60 * 1000,
    retry: (count, err) => count < 2 && (err as { status?: number })?.status !== 401 && (err as { status?: number })?.status !== 403,
  })
}

/** Todos os usuários do sistema (para Step 4 — equipe) */
export function useSystemUsers() {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['system-users-all'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('users')
        .select('id, name, role, avatar_url, is_active')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data ?? []
    },
    enabled: isSessionReady,
    staleTime: 60 * 1000,
    retry: (count, err) => count < 2 && (err as { code?: string })?.code !== 'PGRST301',
  })
}

/** Usuários já vinculados a uma unidade (para pré-selecionar no Step 4) */
export function useUnitTeam(unitId: string | null) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['unit-team', unitId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('user_units')
        .select('user_id, role')
        .eq('unit_id', unitId!)
      if (error) throw error
      return data ?? []
    },
    enabled: !!unitId && isSessionReady,
    staleTime: 30 * 1000,
  })
}

/** Prestadores de uma unidade de origem (para Step 5) */
export function useSourceProviders(sourceUnitId: string | null) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['source-providers', sourceUnitId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('service_providers')
        .select('id, name, document_number, tags, avg_rating, status, provider_contacts(type, value, is_primary)')
        .eq('unit_id', sourceUnitId!)
        .eq('status', 'active')
        .order('name')
      if (error) throw error
      return data ?? []
    },
    enabled: !!sourceUnitId && isSessionReady,
    staleTime: 60 * 1000,
    retry: (count, err) => count < 2 && (err as { code?: string })?.code !== 'PGRST301',
  })
}

/** Lista todas as unidades (para o Step 3 — selecionar unidade de origem) */
export function useAllUnits() {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['all-units'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('units')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data ?? []
    },
    enabled: isSessionReady,
    staleTime: 5 * 60 * 1000,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

/** Copiar templates de uma unidade para outra */
export function useCopyTemplates() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CopyTemplatesPayload) => {
      const res = await fetch('/api/units/copy-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao copiar templates.')
      return res.json() as Promise<{ ok: boolean; result: { checklistTemplates: number; checklistCategories: number; sectors: number; equipmentCategories: number; serviceCategories: number; skipped: number } }>
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['unit-setup-status', variables.targetUnitId] })
    },
  })
}

/** Vincular usuários a uma unidade */
export function useLinkTeam() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { unitId: string; members: TeamMember[] }) => {
      const res = await fetch('/api/units/link-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao vincular equipe.')
      return res.json() as Promise<{ ok: boolean; linked: number; updated: number }>
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['unit-setup-status', variables.unitId] })
      queryClient.invalidateQueries({ queryKey: ['unit-team', variables.unitId] })
    },
  })
}

/** Copiar prestadores de uma unidade para outra */
export function useLinkProviders() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { sourceUnitId: string; targetUnitId: string; providerIds: string[] }) => {
      const res = await fetch('/api/units/link-providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao vincular prestadores.')
      return res.json() as Promise<{ ok: boolean; copied: number; skipped: number; errors: number }>
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['unit-setup-status', variables.targetUnitId] })
    },
  })
}

/** Finalizar setup: salva mapeamento Ploomes + dispara sync (Step 2 + Concluir) */
export function useFinalizeSetup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: FinalizeSetupPayload) => {
      const res = await fetch('/api/units/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao finalizar setup.')
      return res.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['unit-setup-status', variables.unitId] })
      queryClient.invalidateQueries({ queryKey: ['units'] })
    },
  })
}
