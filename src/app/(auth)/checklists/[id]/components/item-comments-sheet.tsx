'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  X, Send, Camera, MessageCircle, Trash2, Image as ImageIcon,
} from 'lucide-react'
import { UserAvatar } from '@/components/shared/user-avatar'
import { compressImage } from '@/components/shared/photo-upload'
import {
  useChecklistItemComments,
  useAddComment,
  useDeleteComment,
} from '@/hooks/use-checklist-comments'
import { useSignedUrls } from '@/hooks/use-signed-urls'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import type { ChecklistItemComment } from '@/types/database.types'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: ptBR })
  } catch {
    return ''
  }
}

// ─────────────────────────────────────────────────────────────
// LIGHTBOX
// ─────────────────────────────────────────────────────────────
function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 flex items-center justify-center w-9 h-9 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        aria-label="Fechar"
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={src}
        alt="Foto do comentário"
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body,
  )
}

// ─────────────────────────────────────────────────────────────
// COMMENT ITEM
// ─────────────────────────────────────────────────────────────
interface CommentItemProps {
  comment: ChecklistItemComment
  currentUserId?: string
  signedUrls: Record<string, string>
  onDelete: () => void
}

function CommentItem({ comment, currentUserId, signedUrls, onDelete }: CommentItemProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [lightboxSrc,   setLightboxSrc]   = useState<string | null>(null)

  const isOwn     = comment.user_id === currentUserId
  const photoUrl  = comment.photo_url ? signedUrls[comment.photo_url] : null
  const user      = comment.user

  function handleDeleteClick() {
    if (confirmDelete) {
      onDelete()
      setConfirmDelete(false)
    } else {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
    }
  }

  return (
    <>
      <div className="group flex gap-2.5">
        {/* Avatar */}
        <div className="shrink-0 mt-0.5">
          <UserAvatar
            name={user?.name ?? '?'}
            avatarUrl={user?.avatar_url}
            size="sm"
            className="w-6 h-6 text-[9px]"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header: name + time */}
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <span className="text-xs font-medium text-foreground">
              {user?.name ?? 'Usuário'}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {timeAgo(comment.created_at)}
            </span>
          </div>

          {/* Text */}
          {comment.content && (
            <p className="text-sm text-foreground whitespace-pre-wrap leading-snug">
              {comment.content}
            </p>
          )}

          {/* Photo thumbnail */}
          {photoUrl && (
            <button
              onClick={() => setLightboxSrc(photoUrl)}
              className="mt-1.5 block"
              aria-label="Ver foto"
            >
              <img
                src={photoUrl}
                alt="Foto"
                className="w-20 h-20 object-cover rounded-lg border border-border hover:opacity-90 transition-opacity"
              />
            </button>
          )}

          {/* Delete button — own comments only */}
          {isOwn && (
            <button
              onClick={handleDeleteClick}
              className={cn(
                'mt-1 flex items-center gap-1 text-[11px] transition-colors',
                confirmDelete
                  ? 'text-red-500'
                  : 'text-muted-foreground opacity-0 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 opacity-100',
              )}
            >
              <Trash2 className="w-3 h-3" />
              {confirmDelete ? 'Confirmar exclusão?' : 'Excluir'}
            </button>
          )}
        </div>
      </div>

      {lightboxSrc && (
        <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export interface ItemCommentsSheetProps {
  open:            boolean
  onClose:         () => void
  itemId:          string
  itemDescription: string
  checklistId:     string
  onCommentsCount?: (count: number) => void
}

export function ItemCommentsSheet({
  open,
  onClose,
  itemId,
  itemDescription,
  checklistId: _checklistId,
  onCommentsCount,
}: ItemCommentsSheetProps) {
  const { profile } = useAuth()
  const qc = useQueryClient()

  const { data: comments = [], isLoading } = useChecklistItemComments(open ? itemId : null)
  const { mutate: addComment, isPending: isSending } = useAddComment()
  const { mutate: deleteComment } = useDeleteComment()

  // Photo paths → signed URLs
  const photoPaths = comments
    .map((c) => c.photo_url)
    .filter((p): p is string => !!p)
  const { data: signedUrls = {} } = useSignedUrls('checklist-comment-photos', photoPaths)

  const [text,          setText]          = useState('')
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null)
  const [photoPreview,  setPhotoPreview]  = useState<string | null>(null)

  const listRef     = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Notify parent of count changes
  useEffect(() => {
    onCommentsCount?.(comments.length)
  }, [comments.length, onCommentsCount])

  // Auto-scroll to bottom when sheet opens or comments change
  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight
      }
    })
  }

  useEffect(() => {
    if (open) scrollToBottom()
  }, [open, comments.length])

  // Realtime subscription
  useEffect(() => {
    if (!open || !itemId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`comments-${itemId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'checklist_item_comments',
          filter: `item_id=eq.${itemId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['checklist-item-comments', itemId] })
          scrollToBottom()
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [open, itemId, qc])

  // Auto-resize textarea
  function handleTextInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px`
  }

  // Photo selection
  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  function removeSelectedPhoto() {
    setSelectedPhoto(null)
    setPhotoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Send
  const handleSend = useCallback(async () => {
    if (!profile?.id) return
    if (!text.trim() && !selectedPhoto) return

    let photoFile: File | undefined
    if (selectedPhoto) {
      const compressed = await compressImage(selectedPhoto, 1200, 0.8)
      photoFile = new File([compressed], `comment_${Date.now()}.jpg`, { type: 'image/jpeg' })
    }

    addComment(
      {
        itemId,
        content: text.trim(),
        photoFile,
        userId: profile.id,
      },
      {
        onSuccess: () => {
          setText('')
          removeSelectedPhoto()
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
          }
          scrollToBottom()
        },
      },
    )
  }, [profile, text, selectedPhoto, addComment, itemId])

  // Delete
  function handleDelete(comment: ChecklistItemComment) {
    if (!profile?.id) return
    deleteComment({
      commentId: comment.id,
      itemId: comment.item_id,
      userId: profile.id,
      photoUrl: comment.photo_url,
    })
  }

  // Keyboard send (Ctrl+Enter / Cmd+Enter)
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (typeof window === 'undefined') return null
  if (!open) return null

  const canSend = (text.trim().length > 0 || !!selectedPhoto) && !isSending

  return createPortal(
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'fixed z-[101] flex flex-col bg-card border-border shadow-xl',
          // Mobile: bottom sheet
          'inset-x-0 bottom-0 max-h-[85svh] rounded-t-2xl border-t',
          // Desktop: right side panel
          'sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:bottom-auto sm:max-h-none sm:h-full sm:w-[400px] sm:rounded-none sm:rounded-l-2xl sm:border-t-0 sm:border-l',
          'animate-scale-in sm:animate-none',
        )}
        style={{
          animationDuration: '200ms',
        }}
      >
        {/* Drag handle (mobile only) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-start gap-3 px-4 py-3 border-b border-border">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Comentários</h2>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{itemDescription}</p>
            {!isLoading && (
              <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                {comments.length === 0
                  ? 'Nenhum comentário'
                  : `${comments.length} comentário${comments.length !== 1 ? 's' : ''}`}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Comments list */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0"
        >
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-muted shrink-0 skeleton-shimmer" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-28 rounded bg-muted skeleton-shimmer" />
                    <div className="h-3 w-full rounded bg-muted skeleton-shimmer" />
                    <div className="h-3 w-2/3 rounded bg-muted skeleton-shimmer" />
                  </div>
                </div>
              ))}
            </div>
          ) : comments.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full min-h-[160px] gap-3 text-muted-foreground">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-muted">
                <MessageCircle className="w-7 h-7 opacity-50" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Nenhum comentário ainda</p>
                <p className="text-xs opacity-60 mt-0.5">
                  Adicione um comentário ou foto de evidência
                </p>
              </div>
            </div>
          ) : (
            comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUserId={profile?.id}
                signedUrls={signedUrls}
                onDelete={() => handleDelete(comment)}
              />
            ))
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-border px-3 py-3"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          {/* Photo preview */}
          {photoPreview && (
            <div className="mb-2 relative inline-block">
              <img
                src={photoPreview}
                alt="Preview"
                className="w-16 h-16 object-cover rounded-lg border border-border"
              />
              <button
                onClick={removeSelectedPhoto}
                className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-5 h-5 rounded-full bg-destructive text-destructive-foreground"
                aria-label="Remover foto"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="flex items-end gap-2">
            {/* Camera button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:bg-muted transition-colors shrink-0"
              aria-label="Adicionar foto"
            >
              {selectedPhoto ? (
                <ImageIcon className="w-4 h-4 text-primary" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
            </button>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextInput}
              onKeyDown={handleKeyDown}
              placeholder="Escreva um comentário…"
              rows={1}
              className="flex-1 resize-none text-sm bg-muted/50 border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/60 max-h-24 leading-snug"
            />

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!canSend}
              className={cn(
                'flex items-center justify-center w-9 h-9 rounded-lg transition-colors shrink-0',
                canSend
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed',
              )}
              aria-label="Enviar comentário"
            >
              {isSending ? (
                <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>

          <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-center">
            Ctrl+Enter para enviar
          </p>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoSelect}
      />
    </>,
    document.body,
  )
}
