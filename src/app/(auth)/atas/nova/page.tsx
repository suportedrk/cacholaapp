'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthReadyStore } from '@/stores/auth-store'
import { useUnitStore } from '@/stores/unit-store'
import { useUnitUsers } from '@/hooks/use-units'
import { useCreateMeetingMinute } from '@/hooks/use-meeting-minute-mutations'
import { MeetingMinuteForm } from '../components/MeetingMinuteForm'
import type { MeetingMinuteFormData } from '@/types/minutes'

const CREATE_ROLES = ['super_admin', 'diretor', 'gerente']

export default function NovaAtaPage() {
  const router   = useRouter()
  const profile  = useAuthReadyStore((s) => s.profile)
  const user     = useAuthReadyStore((s) => s.user)
  const { activeUnitId } = useUnitStore()

  // ── Permission gate ────────────────────────────────────────
  useEffect(() => {
    if (profile && !CREATE_ROLES.includes(profile.role)) {
      router.replace('/atas')
    }
  }, [profile, router])

  // ── Unit guard ─────────────────────────────────────────────
  const hasUnit = !!activeUnitId

  // ── Data ──────────────────────────────────────────────────
  const { data: unitUsersRaw = [] } = useUnitUsers(activeUnitId ?? undefined)
  const unitUsers = unitUsersRaw.map((u) => ({
    id:         u.user.id,
    name:       u.user.name,
    avatar_url: u.user.avatar_url,
    is_active:  u.user.is_active,
  }))

  // ── Mutation ───────────────────────────────────────────────
  const createMinute = useCreateMeetingMinute()

  async function handleSave(form: MeetingMinuteFormData) {
    if (!activeUnitId || !user?.id) return
    const id = await createMinute.mutateAsync({
      unit_id: activeUnitId,
      form,
      userId:  user.id,
    })
    router.push(`/atas`)
    void id
  }

  // ── Render ─────────────────────────────────────────────────
  if (!hasUnit) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <p className="text-sm text-muted-foreground">
          Selecione uma unidade no seletor acima para criar uma ata.
        </p>
      </div>
    )
  }

  if (!user) return null

  return (
    <MeetingMinuteForm
      unitUsers={unitUsers}
      currentUserId={user.id}
      isEditMode={false}
      isSaving={createMinute.isPending}
      onSave={handleSave}
    />
  )
}
