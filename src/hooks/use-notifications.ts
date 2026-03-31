'use client'

import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import type { AppNotification } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// HOOK PRINCIPAL
// ─────────────────────────────────────────────────────────────
export function useNotifications() {
  const qc = useQueryClient()
  // Usa o profile já disponível no AuthProvider — evita getUser() extra
  // que disputaria o lock de auth com auth-guard e use-auth.
  const { profile, loading } = useAuth()
  const userId = (!loading && profile?.id) ? profile.id : null

  // ── Query: últimas 50 notificações ──
  const query = useQuery({
    queryKey: ['notifications', userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data as AppNotification[]
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000, // fallback de polling
  })

  // ── Realtime: subscribe a INSERTs na tabela notifications ──
  useEffect(() => {
    if (!userId) return
    const supabase = createClient()

    const channel = supabase
      .channel(`user-notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['notifications', userId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, qc])

  // ── Mutation: marcar uma como lida ──
  const markRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', userId] })
    },
  })

  // ── Mutation: marcar todas como lidas ──
  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!userId) return
      const supabase = createClient()
      const { error } = await supabase.rpc('mark_all_notifications_read', {
        p_user_id: userId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', userId] })
    },
  })

  // ── Mutation: deletar (arquivar) notificação ──
  const deleteNotification = useMutation({
    mutationFn: async (notificationId: string) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', userId] })
    },
  })

  const notifications = query.data ?? []
  const unreadCount = notifications.filter((n) => !n.is_read).length

  return {
    notifications,
    unreadCount,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => query.refetch(),
    markRead: (id: string) => markRead.mutate(id),
    markAllRead: () => markAllRead.mutate(),
    isMarkingAll: markAllRead.isPending,
    deleteNotification: (id: string) => deleteNotification.mutate(id),
  }
}
