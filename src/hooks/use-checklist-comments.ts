'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { ChecklistItemComment } from '@/types/database.types'
import { notifyChecklistItemCommented } from '@/lib/notifications'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'

const RETRY = (failureCount: number, error: unknown) => {
  const status = (error as { status?: number })?.status
  if (status === 401 || status === 403) return false
  return failureCount < 2
}

// ─────────────────────────────────────────────────────────────
// LISTAR COMENTÁRIOS DE UM ITEM
// Thread cronológica (ASC)
// ─────────────────────────────────────────────────────────────
export function useChecklistItemComments(itemId: string | null) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['checklist-item-comments', itemId],
    enabled: !!itemId && isSessionReady,
    retry: RETRY,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('checklist_item_comments')
        .select(`
          *,
          user:users!checklist_item_comments_user_id_fkey(id, name, avatar_url)
        `)
        .eq('item_id', itemId!)
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data ?? []) as unknown as ChecklistItemComment[]
    },
  })
}

// ─────────────────────────────────────────────────────────────
// ADICIONAR COMENTÁRIO
// ─────────────────────────────────────────────────────────────
export function useAddComment() {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async ({
      itemId,
      content,
      photoFile,
      userId,
    }: {
      itemId: string
      content: string
      photoFile?: File
      userId: string
    }) => {
      const supabase = createClient()

      let photo_url: string | null = null

      if (photoFile) {
        const ext = photoFile.name.split('.').pop() ?? 'jpg'
        const path = `${userId}/${itemId}/${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('checklist-comment-photos')
          .upload(path, photoFile)
        if (uploadErr) throw uploadErr
        photo_url = path  // guardamos o path (privado → signed URL para exibição)
      }

      const { data, error } = await supabase
        .from('checklist_item_comments')
        .insert({
          item_id: itemId,
          user_id: userId,
          content: content.trim(),
          photo_url,
          unit_id: activeUnitId!,
        })
        .select('id')
        .single()

      if (error) throw error
      return { commentId: data.id, itemId }
    },
    onSuccess: ({ itemId }, { userId }) => {
      qc.invalidateQueries({ queryKey: ['checklist-item-comments', itemId] })
      // Notificar assigned_to do item (fire-and-forget)
      ;(async () => {
        try {
          const sb = createClient()
          await notifyChecklistItemCommented(sb as any, itemId, userId)
        } catch { /* não-crítico */ }
      })()
    },
    onError: () => toast.error('Erro ao adicionar comentário.'),
  })
}

// ─────────────────────────────────────────────────────────────
// DELETAR COMENTÁRIO (apenas o autor)
// ─────────────────────────────────────────────────────────────
export function useDeleteComment() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      commentId,
      itemId,
      userId,
      photoUrl,
    }: {
      commentId: string
      itemId: string
      userId: string
      photoUrl?: string | null
    }) => {
      const supabase = createClient()

      // Só o autor pode deletar (RLS também garante, mas validamos client-side)
      const { data: comment } = await supabase
        .from('checklist_item_comments')
        .select('user_id')
        .eq('id', commentId)
        .single()

      if (comment?.user_id !== userId) {
        throw new Error('Você não tem permissão para excluir este comentário.')
      }

      // Remover foto do storage (best-effort)
      if (photoUrl) {
        await supabase.storage
          .from('checklist-comment-photos')
          .remove([photoUrl])
          .catch(() => {/* ignora erro de storage */})
      }

      const { error } = await supabase
        .from('checklist_item_comments')
        .delete()
        .eq('id', commentId)

      if (error) throw error
      return { itemId }
    },
    onSuccess: ({ itemId }) => {
      qc.invalidateQueries({ queryKey: ['checklist-item-comments', itemId] })
      toast.success('Comentário excluído.')
    },
    onError: (err: Error) => toast.error(err.message || 'Erro ao excluir comentário.'),
  })
}
