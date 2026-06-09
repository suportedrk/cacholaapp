'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuthReadyStore } from '@/stores/auth-store'
import { useUnitStore } from '@/stores/unit-store'
import { useUnitUsers } from '@/hooks/use-units'
import { useUsers } from '@/hooks/use-users'
import { useMeetingMinuteDetail } from '@/hooks/use-meeting-minute-detail'
import { useUpdateMeetingMinute } from '@/hooks/use-meeting-minute-mutations'
import { useAtasPermissions } from '@/hooks/use-atas-permissions'
import { MeetingMinuteForm, buildOriginalLists } from '../../components/MeetingMinuteForm'
import { DIRETORIA_ROLES, hasRole } from '@/config/roles'
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

  // Ata geral (unit_id null): participantes podem ser das duas unidades, então
  // a lista precisa abranger ambas — senão o ParticipantSelector não encontra o
  // colaborador da outra unidade e o chip some. Só a diretoria chega aqui (gate abaixo).
  const { data: allActiveUsers = [] } = useUsers({ isActive: true })
  const globalUsers = allActiveUsers.map((u) => ({
    id:         u.id,
    name:       u.name,
    avatar_url: u.avatar_url,
    is_active:  u.is_active,
  }))

  const formUsers = minute && minute.unit_id == null ? globalUsers : unitUsers

  // ── Permission gate ────────────────────────────────────────
  // Pode editar se: permissão de edit + (diretoria OU a ata não é geral).
  // Espera a permissão E a ata carregarem antes de decidir o redirect.
  const perms = useAtasPermissions()
  useEffect(() => {
    if (perms.isLoading || isLoading || !minute || !profile) return
    const isDiretoria = hasRole(profile.role, DIRETORIA_ROLES)
    const canEdit = perms.canEdit && (isDiretoria || minute.unit_id != null)
    if (!canEdit) {
      router.replace('/atas')
    }
  }, [perms.isLoading, perms.canEdit, isLoading, minute, profile, router])

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
  if (isLoading || perms.isLoading) {
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
      unitUsers={formUsers}
      currentUserId={user.id}
      isEditMode={true}
      isSaving={updateMinute.isPending}
      onSave={handleSave}
    />
  )
}
