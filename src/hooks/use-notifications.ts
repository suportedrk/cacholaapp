'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { AppNotification } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// HOOK PRINCIPAL
// ─────────────────────────────────────────────────────────────
export function useNotifications() {
  const qc = useQueryClient()
  const [userId, setUserId] = useState<string | null>(null)

  // Obtém userId uma única vez ao montar
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null)
    })
  }, [])

  // ── Query: últimas 20 notificações ──
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
        .limit(20)
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

  const notifications = query.data ?? []
  const unreadCount = notifications.filter((n) => !n.is_read).length

  return {
    notifications,
    unreadCount,
    isLoading: query.isLoading,
    markRead: (id: string) => markRead.mutate(id),
    markAllRead: () => markAllRead.mutate(),
    isMarkingAll: markAllRead.isPending,
  }
}
