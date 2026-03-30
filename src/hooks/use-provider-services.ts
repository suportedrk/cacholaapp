'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useUnitStore } from '@/stores/unit-store'
import type { CreateServiceInput, UpdateServiceInput } from '@/types/providers'

// ─────────────────────────────────────────────────────────────
// useCreateProviderService
// ─────────────────────────────────────────────────────────────
export function useCreateProviderService() {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async (input: CreateServiceInput) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('provider_services')
        .insert(input)
        .select('*, category:service_categories(*)')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['provider', data.provider_id, activeUnitId] })
      qc.invalidateQueries({ queryKey: ['providers', activeUnitId] })
      toast.success('Serviço adicionado.')
    },
    onError: (error: unknown) => {
      const msg = (error as { message?: string })?.message ?? ''
      if (msg.includes('unique') || msg.includes('duplicate')) {
        toast.error('Este prestador já possui este serviço cadastrado.')
      } else {
        toast.error('Erro ao adicionar serviço.')
      }
    },
  })
}

// ─────────────────────────────────────────────────────────────
// useUpdateProviderService
// ─────────────────────────────────────────────────────────────
export function useUpdateProviderService() {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async ({ id, provider_id, ...patch }: UpdateServiceInput) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('provider_services')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return { ...data, provider_id }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['provider', data.provider_id, activeUnitId] })
      qc.invalidateQueries({ queryKey: ['providers', activeUnitId] })
      toast.success('Serviço atualizado.')
    },
    onError: () => toast.error('Erro ao atualizar serviço.'),
  })
}

// ─────────────────────────────────────────────────────────────
// useDeleteProviderService
// ─────────────────────────────────────────────────────────────
export function useDeleteProviderService() {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async ({ id, provider_id }: { id: string; provider_id: string }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('provider_services')
        .delete()
        .eq('id', id)
      if (error) throw error
      return { id, provider_id }
    },
    onSuccess: ({ provider_id }) => {
      qc.invalidateQueries({ queryKey: ['provider', provider_id, activeUnitId] })
      qc.invalidateQueries({ queryKey: ['providers', activeUnitId] })
      toast.success('Serviço removido.')
    },
    onError: () => toast.error('Erro ao remover serviço.'),
  })
}
