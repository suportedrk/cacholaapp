'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { MeetingMinuteFormData, ParticipantDraft, ActionItemDraft, ActionItemStatus, MeetingMinuteDetail, ParticipantRole } from '@/types/minutes'

// ─────────────────────────────────────────────────────────────
// Helpers — typed wrappers around untyped tables
// (meeting_minutes / meeting_participants / meeting_action_items
// are not yet regenerated in database.types.ts — cast via any)
// ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(supabase: ReturnType<typeof createClient>): any {
  return supabase
}

// ─────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────

interface CreatePayload {
  unit_id: string
  form:    MeetingMinuteFormData
  userId:  string
}

export function useCreateMeetingMinute() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ unit_id, form, userId }: CreatePayload) => {
      const supabase = createClient()
      const d = db(supabase)

      // 1. Insert meeting_minutes
      const { data: minute, error: minuteErr } = await d
        .from('meeting_minutes')
        .insert({
          unit_id,
          title:        form.title.trim(),
          meeting_date: form.meeting_date,
          location:     form.location.trim() || null,
          summary:      form.summary.trim()  || null,
          notes:        form.notes.trim()    || null,
          status:       form.status,
          created_by:   userId,
        })
        .select('id')
        .single()

      if (minuteErr) throw minuteErr

      const minuteId = (minute as { id: string }).id

      // 2. Insert participants (warn on partial failure)
      if (form.participants.length > 0) {
        const participantRows = form.participants.map((p: ParticipantDraft) => ({
          meeting_id: minuteId,
          user_id:    p.user_id,
          role:       p.role,
        }))
        const { error: partErr } = await d
          .from('meeting_participants')
          .insert(participantRows)
        if (partErr) {
          console.error('Participants insert error:', partErr)
          toast.warning('Alguns participantes não foram salvos.')
        }
      }

      // 3. Insert action items (warn on partial failure)
      const nonEmptyItems = form.action_items.filter((a) => a.description.trim())
      if (nonEmptyItems.length > 0) {
        const actionRows = nonEmptyItems.map((a: ActionItemDraft) => ({
          meeting_id:  minuteId,
          description: a.description.trim(),
          assigned_to: a.assigned_to || null,
          due_date:    a.due_date    || null,
          status:      a.status,
        }))
        const { error: actionErr } = await d
          .from('meeting_action_items')
          .insert(actionRows)
        if (actionErr) {
          console.error('Action items insert error:', actionErr)
          toast.warning('Alguns itens de ação não foram salvos.')
        }
      }

      return minuteId
    },
    onSuccess: (minuteId, { form }) => {
      qc.invalidateQueries({ queryKey: ['meeting-minutes'] })
      toast.success('Ata criada com sucesso!')

      // Fire-and-forget notification if published at creation
      if (form.status === 'published') {
        fetch('/api/minutes/notify', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ meetingMinuteId: minuteId, previousStatus: null }),
        }).catch((err) => console.error('[minutes] Falha ao notificar participantes:', err))
      }
    },
    onError: () => {
      toast.error('Erro ao criar ata. Tente novamente.')
    },
  })
}

// ─────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────

interface UpdatePayload {
  id:                   string
  form:                 MeetingMinuteFormData
  previousStatus:       string
  originalParticipants: ParticipantDraft[]
  originalActionItems:  ActionItemDraft[]
}

export function useUpdateMeetingMinute() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      form,
      originalParticipants,
      originalActionItems,
    }: UpdatePayload) => {
      const supabase = createClient()
      const d = db(supabase)

      // 1. Update meeting_minutes
      const { error: updateErr } = await d
        .from('meeting_minutes')
        .update({
          title:        form.title.trim(),
          meeting_date: form.meeting_date,
          location:     form.location.trim() || null,
          summary:      form.summary.trim()  || null,
          notes:        form.notes.trim()    || null,
          status:       form.status,
        })
        .eq('id', id)

      if (updateErr) throw updateErr

      // 2. Sync participants — delete removed, upsert present
      const originalUserIds = new Set(originalParticipants.map((p) => p.user_id))
      const currentUserIds  = new Set(form.participants.map((p) => p.user_id))

      const removedUserIds = [...originalUserIds].filter((uid) => !currentUserIds.has(uid))
      if (removedUserIds.length > 0) {
        const { error } = await d
          .from('meeting_participants')
          .delete()
          .eq('meeting_id', id)
          .in('user_id', removedUserIds)
        if (error) console.error('Participants delete error:', error)
      }

      if (form.participants.length > 0) {
        const rows = form.participants.map((p: ParticipantDraft) => ({
          meeting_id: id,
          user_id:    p.user_id,
          role:       p.role,
        }))
        const { error } = await d
          .from('meeting_participants')
          .upsert(rows, { onConflict: 'meeting_id,user_id' })
        if (error) {
          console.error('Participants upsert error:', error)
          toast.warning('Alguns participantes não foram atualizados.')
        }
      }

      // 3. Sync action items
      const originalItemIds = new Set(
        originalActionItems.map((a) => a.id).filter(Boolean)
      )
      const currentItemIds = new Set(
        form.action_items.filter((a) => a.id).map((a) => a.id as string)
      )

      const removedItemIds = [...originalItemIds].filter(
        (iid) => !currentItemIds.has(iid as string)
      )
      if (removedItemIds.length > 0) {
        const { error } = await d
          .from('meeting_action_items')
          .delete()
          .in('id', removedItemIds)
        if (error) console.error('Action items delete error:', error)
      }

      const nonEmptyItems = form.action_items.filter((a) => a.description.trim())
      const itemsToUpsert = nonEmptyItems.filter((a) => a.id)
      const itemsToInsert = nonEmptyItems.filter((a) => !a.id)

      if (itemsToUpsert.length > 0) {
        const rows = itemsToUpsert.map((a) => ({
          id:          a.id!,
          meeting_id:  id,
          description: a.description.trim(),
          assigned_to: a.assigned_to || null,
          due_date:    a.due_date    || null,
          status:      a.status,
        }))
        const { error } = await d.from('meeting_action_items').upsert(rows)
        if (error) {
          console.error('Action items upsert error:', error)
          toast.warning('Alguns itens de ação não foram atualizados.')
        }
      }

      if (itemsToInsert.length > 0) {
        const rows = itemsToInsert.map((a) => ({
          meeting_id:  id,
          description: a.description.trim(),
          assigned_to: a.assigned_to || null,
          due_date:    a.due_date    || null,
          status:      a.status,
        }))
        const { error } = await d.from('meeting_action_items').insert(rows)
        if (error) {
          console.error('Action items insert error:', error)
          toast.warning('Alguns itens de ação não foram salvos.')
        }
      }

      return id
    },
    onSuccess: (id, { form, previousStatus }) => {
      qc.invalidateQueries({ queryKey: ['meeting-minutes'] })
      qc.invalidateQueries({ queryKey: ['meeting-minutes', 'detail', id] })
      toast.success('Ata atualizada com sucesso!')

      // Fire-and-forget notification only on draft → published transition
      if (form.status === 'published' && previousStatus !== 'published') {
        fetch('/api/minutes/notify', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ meetingMinuteId: id, previousStatus }),
        }).catch((err) => console.error('[minutes] Falha ao notificar participantes:', err))
      }
    },
    onError: () => {
      toast.error('Erro ao atualizar ata. Tente novamente.')
    },
  })
}

// ─────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────

export function useDeleteMeetingMinute() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await db(supabase)
        .from('meeting_minutes')
        .delete()
        .eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meeting-minutes'] })
      toast.success('Ata excluída.')
    },
    onError: () => {
      toast.error('Erro ao excluir ata.')
    },
  })
}

// ─────────────────────────────────────────────────────────────
// TOGGLE ACTION ITEM STATUS (optimistic update)
// ─────────────────────────────────────────────────────────────

interface ToggleActionItemPayload {
  actionItemId: string
  meetingId:    string
  newStatus:    ActionItemStatus
}

export function useToggleActionItemStatus() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ actionItemId, newStatus }: ToggleActionItemPayload) => {
      const supabase = createClient()
      const { error } = await db(supabase)
        .from('meeting_action_items')
        .update({ status: newStatus })
        .eq('id', actionItemId)
      if (error) throw error
    },
    onMutate: async ({ actionItemId, meetingId, newStatus }) => {
      const queryKey = ['meeting-minutes', 'detail', meetingId]
      await qc.cancelQueries({ queryKey })
      const prev = qc.getQueryData<MeetingMinuteDetail>(queryKey)

      if (prev) {
        qc.setQueryData<MeetingMinuteDetail>(queryKey, {
          ...prev,
          action_items: prev.action_items.map((item) =>
            item.id === actionItemId ? { ...item, status: newStatus } : item
          ),
        })
      }

      return { prev }
    },
    onError: (_err, { meetingId }, context) => {
      if (context?.prev) {
        qc.setQueryData(['meeting-minutes', 'detail', meetingId], context.prev)
      }
      toast.error('Erro ao atualizar item de ação.')
    },
    onSettled: (_data, _err, { meetingId }) => {
      qc.invalidateQueries({ queryKey: ['meeting-minutes', 'detail', meetingId] })
      qc.invalidateQueries({ queryKey: ['meeting-minutes'] })
    },
  })
}

// ─────────────────────────────────────────────────────────────
// DUPLICATE — copy metadata + participants as a new draft
// ─────────────────────────────────────────────────────────────

interface DuplicatePayload {
  unitId:        string
  title:         string
  location:      string | null
  participants:  Array<{ user_id: string; role: ParticipantRole }>
  currentUserId: string
}

export function useDuplicateMeetingMinute() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ unitId, title, location, participants, currentUserId }: DuplicatePayload) => {
      const supabase = createClient()
      const d = db(supabase)

      const today = new Date().toISOString().slice(0, 10)

      // 1. Insert new meeting_minutes as draft
      const { data: newMinute, error: minuteErr } = await d
        .from('meeting_minutes')
        .insert({
          unit_id:      unitId,
          title,
          meeting_date: today,
          location,
          summary:      null,
          notes:        null,
          status:       'draft',
          created_by:   currentUserId,
        })
        .select('id')
        .single()

      if (minuteErr) throw minuteErr

      const newId = (newMinute as { id: string }).id

      // 2. Copy participants (reset notified_at)
      if (participants.length > 0) {
        const rows = participants.map((p) => ({
          meeting_id:   newId,
          user_id:      p.user_id,
          role:         p.role,
          notified_at:  null,
        }))
        const { error: partErr } = await d.from('meeting_participants').insert(rows)
        if (partErr) {
          console.error('Duplicate participants insert error:', partErr)
          toast.warning('Alguns participantes não foram copiados.')
        }
      }

      return newId
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meeting-minutes'] })
      toast.success('Ata duplicada como rascunho.')
    },
    onError: () => {
      toast.error('Erro ao duplicar ata. Tente novamente.')
    },
  })
}
