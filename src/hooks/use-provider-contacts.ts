'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useUnitStore } from '@/stores/unit-store'
import type { CreateContactInput, UpdateContactInput } from '@/types/providers'

// ─────────────────────────────────────────────────────────────
// useCreateContact
// ─────────────────────────────────────────────────────────────
export function useCreateContact() {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async (input: CreateContactInput) => {
      const supabase = createClient()

      // If this contact should be primary, unset any existing primary first
      if (input.is_primary) {
        await supabase
          .from('provider_contacts')
          .update({ is_primary: false })
          .eq('provider_id', input.provider_id)
          .eq('is_primary', true)
      }

      const { data, error } = await supabase
        .from('provider_contacts')
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['provider', data.provider_id, activeUnitId] })
      toast.success('Contato adicionado.')
    },
    onError: () => toast.error('Erro ao adicionar contato.'),
  })
}

// ─────────────────────────────────────────────────────────────
// useUpdateContact
// ─────────────────────────────────────────────────────────────
export function useUpdateContact() {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async ({ id, provider_id, unit_id, ...patch }: UpdateContactInput) => {
      const supabase = createClient()

      // If setting as primary, unset existing primary first
      if (patch.is_primary) {
        await supabase
          .from('provider_contacts')
          .update({ is_primary: false })
          .eq('provider_id', provider_id)
          .eq('is_primary', true)
          .neq('id', id)
      }

      const { data, error } = await supabase
        .from('provider_contacts')
        .update({ ...patch, unit_id })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return { ...data, provider_id }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['provider', data.provider_id, activeUnitId] })
      toast.success('Contato atualizado.')
    },
    onError: () => toast.error('Erro ao atualizar contato.'),
  })
}

// ─────────────────────────────────────────────────────────────
// useDeleteContact
// ─────────────────────────────────────────────────────────────
export function useDeleteContact() {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async ({ id, provider_id }: { id: string; provider_id: string }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('provider_contacts')
        .delete()
        .eq('id', id)
      if (error) throw error
      return { id, provider_id }
    },
    onSuccess: ({ provider_id }) => {
      qc.invalidateQueries({ queryKey: ['provider', provider_id, activeUnitId] })
      toast.success('Contato removido.')
    },
    onError: () => toast.error('Erro ao remover contato.'),
  })
}
