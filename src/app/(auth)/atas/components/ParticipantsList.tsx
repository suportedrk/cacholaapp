import { UserAvatar } from '@/components/shared/user-avatar'
import { PARTICIPANT_ROLE_LABELS } from '@/types/minutes'
import type { MeetingMinuteParticipantDetail } from '@/types/minutes'
import { cn } from '@/lib/utils'

interface ParticipantsListProps {
  participants: MeetingMinuteParticipantDetail[]
}

const roleBadgeClass: Record<string, string> = {
  organizer:   'badge-brand border',
  participant: 'badge-gray border',
  absent:      'badge-amber border',
}

export function ParticipantsList({ participants }: ParticipantsListProps) {
  if (participants.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Nenhum participante registrado.</p>
    )
  }

  return (
    <div className="flex flex-wrap gap-4">
      {participants.map((p) => {
        const name    = p.user?.name ?? 'Usuário removido'
        const isAbsent = p.role === 'absent'

        return (
          <div
            key={p.user_id}
            className={cn('flex items-center gap-2.5', isAbsent && 'opacity-60')}
          >
            <UserAvatar
              name={name}
              avatarUrl={p.user?.avatar_url}
              size="md"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight truncate">{name}</p>
              <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', roleBadgeClass[p.role] ?? 'badge-gray border')}>
                {PARTICIPANT_ROLE_LABELS[p.role]}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
