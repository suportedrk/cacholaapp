'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { MeetingMinuteFormData, ParticipantDraft, ActionItemDraft, ActionItemStatus, MeetingMinuteDetail } from '@/types/minutes'

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meeting-minutes'] })
      toast.success('Ata criada com sucesso!')
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
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['meeting-minutes'] })
      qc.invalidateQueries({ queryKey: ['meeting-minutes', 'detail', id] })
      toast.success('Ata atualizada com sucesso!')
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
