'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { PreReservaDiretoriaInsert, PreReservaDiretoriaUpdate } from '@/types/pre-reservas'

// Helper para tabela sem type casting no database.types.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(supabase: ReturnType<typeof createClient>): any {
  return supabase
}

// ─────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────

export function useCreatePreReserva() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: PreReservaDiretoriaInsert) => {
      const supabase = createClient()
      const { data, error } = await db(supabase)
        .from('pre_reservas_diretoria')
        .insert(payload)
        .select('id')
        .single()
      if (error) throw error
      return data as { id: string }
    },
    onSuccess: () => {
      toast.success('Pré-reserva criada com sucesso')
      void qc.invalidateQueries({ queryKey: ['pre-reservas-diretoria'] })
    },
    onError: () => {
      toast.error('Erro ao criar pré-reserva. Tente novamente.')
    },
  })
}

// ─────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────

export function useUpdatePreReserva() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...payload }: PreReservaDiretoriaUpdate & { id: string }) => {
      const supabase = createClient()
      const { error } = await db(supabase)
        .from('pre_reservas_diretoria')
        .update(payload)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Pré-reserva atualizada com sucesso')
      void qc.invalidateQueries({ queryKey: ['pre-reservas-diretoria'] })
    },
    onError: () => {
      toast.error('Erro ao atualizar pré-reserva. Tente novamente.')
    },
  })
}

// ─────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────

export function useDeletePreReserva() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await db(supabase)
        .from('pre_reservas_diretoria')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Pré-reserva excluída')
      void qc.invalidateQueries({ queryKey: ['pre-reservas-diretoria'] })
    },
    onError: () => {
      toast.error('Erro ao excluir pré-reserva. Tente novamente.')
    },
  })
}
