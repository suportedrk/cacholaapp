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
