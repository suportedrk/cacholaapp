'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useAuthReadyStore } from '@/stores/auth-store'
import type { Seller, SellerFormInput } from '@/types/seller'

export function useSellers() {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  return useQuery({
    queryKey: ['sellers'],
    enabled: isSessionReady,
    staleTime: 5 * 60 * 1000,
    retry: (count, err: unknown) => {
      const status = (err as { status?: number })?.status
      return count < 3 && status !== 401 && status !== 403
    },
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('sellers')
        .select('*')
        .order('name')
      if (error) throw error
      return (data ?? []) as Seller[]
    },
  })
}

/**
 * Sellers ativas, não-sistema e ainda sem usuário vinculado.
 * Usado no formulário de convite quando role=vendedora.
 */
export function useAvailableSellersForInvite() {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  return useQuery({
    queryKey: ['sellers', 'available-for-invite'],
    enabled: isSessionReady,
    staleTime: 60 * 1000,
    retry: (count, err: unknown) => {
      const status = (err as { status?: number })?.status
      return count < 3 && status !== 401 && status !== 403
    },
    queryFn: async () => {
      const supabase = createClient()

      // Busca sellers ativas e não-sistema
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: allSellers, error: sellersError } = await (supabase as any)
        .from('sellers')
        .select('id, name')
        .eq('status', 'active')
        .eq('is_system_account', false)
        .order('name')
      if (sellersError) throw sellersError

      // Busca seller_ids já vinculados a algum usuário
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: taken, error: takenError } = await (supabase as any)
        .from('users')
        .select('seller_id')
        .not('seller_id', 'is', null)
      if (takenError) throw takenError

      const takenIds = new Set((taken ?? []).map((r: { seller_id: string }) => r.seller_id))
      return (allSellers ?? []).filter(
        (s: { id: string; name: string }) => !takenIds.has(s.id)
      ) as { id: string; name: string }[]
    },
  })
}

export function useUpdateSeller() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: SellerFormInput }) => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('sellers')
        .update(input)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Seller
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellers'] })
      toast.success('Vendedora atualizada com sucesso.')
    },
    onError: () => {
      toast.error('Erro ao atualizar vendedora. Tente novamente.')
    },
  })
}
