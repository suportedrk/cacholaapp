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

/** Usuário vinculado a uma vendedora (via users.seller_id). */
export interface SellerUserLink {
  user_id: string
  name: string
  email: string | null
}

/**
 * Mapa seller_id → usuário vinculado. Alimenta a coluna "Usuário vinculado"
 * da listagem de vendedoras. RLS já permite a leitura de users para
 * super_admin/diretor (mesmas roles da tela).
 */
export function useSellerUserLinks() {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  return useQuery({
    queryKey: ['sellers', 'user-links'],
    enabled: isSessionReady,
    staleTime: 60 * 1000,
    retry: (count, err: unknown) => {
      const status = (err as { status?: number })?.status
      return count < 3 && status !== 401 && status !== 403
    },
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('users')
        .select('id, name, email, seller_id')
        .not('seller_id', 'is', null)
      if (error) throw error
      const map: Record<string, SellerUserLink> = {}
      for (const u of (data ?? []) as {
        id: string
        name: string
        email: string | null
        seller_id: string
      }[]) {
        map[u.seller_id] = { user_id: u.id, name: u.name, email: u.email }
      }
      return map
    },
  })
}

/** Usuário elegível para receber o vínculo de uma vendedora. */
export interface LinkableUser {
  id: string
  name: string
  email: string | null
  role: string
}

/**
 * Usuários ativos e ainda sem vendedora vinculada (seller_id IS NULL).
 * Usado no seletor de "revincular" do edit-sheet. Lazy: só dispara quando
 * `enabled` (sheet aberto e vendedora apta a vincular).
 */
export function useUsersAvailableForSellerLink(enabled: boolean) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  return useQuery({
    queryKey: ['users', 'available-for-seller-link'],
    enabled: isSessionReady && enabled,
    staleTime: 30 * 1000,
    retry: (count, err: unknown) => {
      const status = (err as { status?: number })?.status
      return count < 3 && status !== 401 && status !== 403
    },
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('users')
        .select('id, name, email, role')
        .is('seller_id', null)
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return (data ?? []) as LinkableUser[]
    },
  })
}

/**
 * Vincula (user_id) ou desvincula (null) uma vendedora a um usuário, via
 * POST /api/admin/sellers/[id]/link. Invalida sellers + os mapas derivados.
 */
export function useSetSellerUserLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      sellerId,
      userId,
    }: {
      sellerId: string
      userId: string | null
    }) => {
      const res = await fetch(`/api/admin/sellers/${sellerId}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Erro ao atualizar o vínculo.')
      return body as { ok: boolean; linked: boolean }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sellers', 'user-links'] })
      // Prefixo ['users'] cobre tanto a lista do /admin/usuarios (['users', filters])
      // quanto o pool de elegíveis (['users','available-for-seller-link']).
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['sellers', 'available-for-invite'] })
      toast.success(data.linked ? 'Usuário vinculado à vendedora.' : 'Vínculo removido.')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar o vínculo.')
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
