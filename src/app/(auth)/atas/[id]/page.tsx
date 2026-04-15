'use client'

import { useParams, useRouter } from 'next/navigation'
import { useAuthReadyStore } from '@/stores/auth-store'
import { useMeetingMinuteDetail } from '@/hooks/use-meeting-minute-detail'
import { MeetingMinuteDetailView } from '../components/MeetingMinuteDetailView'

const ELEVATED_ROLES = ['super_admin', 'diretor', 'gerente']

export default function AtaDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id     = typeof params.id === 'string' ? params.id : undefined

  const profile = useAuthReadyStore((s) => s.profile)
  const user    = useAuthReadyStore((s) => s.user)

  const {
    data: minute,
    isLoading,
    isError,
  } = useMeetingMinuteDetail(id)

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

  if (!user || !profile) return null

  const isElevated = ELEVATED_ROLES.includes(profile.role)
  const isCreator  = minute.created_by === user.id
  const canEdit    = isElevated || isCreator
  const canDelete  = isElevated || isCreator
  const canCreate  = isElevated

  return (
    <MeetingMinuteDetailView
      minute={minute}
      currentUserId={user.id}
      canEdit={canEdit}
      canDelete={canDelete}
      canCreate={canCreate}
      isElevated={isElevated}
    />
  )
}
