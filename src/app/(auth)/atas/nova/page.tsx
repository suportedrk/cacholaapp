'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthReadyStore } from '@/stores/auth-store'
import { useUnitStore } from '@/stores/unit-store'
import { useUnitUsers } from '@/hooks/use-units'
import { useCreateMeetingMinute } from '@/hooks/use-meeting-minute-mutations'
import { useAtasPermissions } from '@/hooks/use-atas-permissions'
import { MeetingMinuteForm } from '../components/MeetingMinuteForm'
import type { MeetingMinuteFormData } from '@/types/minutes'

export default function NovaAtaPage() {
  const router   = useRouter()
  const user     = useAuthReadyStore((s) => s.user)
  const { activeUnitId } = useUnitStore()

  // ── Permission gate ────────────────────────────────────────
  // Espera a permissão resolver antes de decidir o redirect (sem flicker).
  const perms = useAtasPermissions()
  useEffect(() => {
    if (!perms.isLoading && !perms.canCreate) {
      router.replace('/atas')
    }
  }, [perms.isLoading, perms.canCreate, router])

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
  // Enquanto a permissão não resolve, mostra carregando — não renderiza o
  // formulário nem decide o redirect ainda.
  if (perms.isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-sm text-muted-foreground">Carregando…</span>
      </div>
    )
  }

  // Sem permissão de criar: o efeito acima já dispara o redirect; evita flash do form.
  if (!perms.canCreate) return null

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
