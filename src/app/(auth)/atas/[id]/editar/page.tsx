'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuthReadyStore } from '@/stores/auth-store'
import { useUnitStore } from '@/stores/unit-store'
import { useUnitUsers } from '@/hooks/use-units'
import { useMeetingMinuteDetail } from '@/hooks/use-meeting-minute-detail'
import { useUpdateMeetingMinute } from '@/hooks/use-meeting-minute-mutations'
import { MeetingMinuteForm, buildOriginalLists } from '../../components/MeetingMinuteForm'
import { ATAS_MANAGE_ROLES, hasRole } from '@/config/roles'
import type { MeetingMinuteFormData } from '@/types/minutes'

export default function EditarAtaPage() {
  const router   = useRouter()
  const params   = useParams()
  const id       = typeof params.id === 'string' ? params.id : undefined

  const profile = useAuthReadyStore((s) => s.profile)
  const user    = useAuthReadyStore((s) => s.user)
  const { activeUnitId } = useUnitStore()

  // ── Data ──────────────────────────────────────────────────
  const {
    data: minute,
    isLoading,
    isError,
  } = useMeetingMinuteDetail(id)

  const { data: unitUsersRaw = [] } = useUnitUsers(activeUnitId ?? undefined)
  const unitUsers = unitUsersRaw.map((u) => ({
    id:         u.user.id,
    name:       u.user.name,
    avatar_url: u.user.avatar_url,
    is_active:  u.user.is_active,
  }))

  // ── Permission gate ────────────────────────────────────────
  // Redirect if user doesn't have edit rights:
  //  - elevated role (super_admin/diretor/gerente) OR
  //  - is the creator of the minute
  useEffect(() => {
    if (!profile || !user || !minute) return
    const isElevated = hasRole(profile.role, ATAS_MANAGE_ROLES)
    const isCreator  = minute.created_by === user.id
    if (!isElevated && !isCreator) {
      router.replace('/atas')
    }
  }, [profile, user, minute, router])

  // ── Mutation ───────────────────────────────────────────────
  const updateMinute = useUpdateMeetingMinute()

  async function handleSave(form: MeetingMinuteFormData) {
    if (!id || !minute) return
    const { participants, action_items } = buildOriginalLists(minute)
    await updateMinute.mutateAsync({
      id,
      form,
      previousStatus:       minute.status,
      originalParticipants: participants,
      originalActionItems:  action_items,
    })
    router.push('/atas')
  }

  // ── Render ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-sm text-muted-foreground">Carregando ata…</span>
      </div>
    )
  }

  if (isError || !minute) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <p className="text-sm text-muted-foreground">
          Ata não encontrada ou sem permissão de acesso.
        </p>
        <button
          onClick={() => router.push('/atas')}
          className="text-sm text-primary hover:underline"
        >
          Voltar para atas
        </button>
      </div>
    )
  }

  if (!user) return null

  return (
    <MeetingMinuteForm
      minute={minute}
      unitUsers={unitUsers}
      currentUserId={user.id}
      isEditMode={true}
      isSaving={updateMinute.isPending}
      onSave={handleSave}
    />
  )
}
