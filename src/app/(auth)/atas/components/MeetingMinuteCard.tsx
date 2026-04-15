'use client'

import { memo } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, CheckSquare, CalendarDays } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn, getInitials, getAvatarColor } from '@/lib/utils'
import { MEETING_STATUS_LABELS } from '@/types/minutes'
import type { MeetingMinuteForList } from '@/types/minutes'

// ─────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, string> = {
  draft:     'badge-amber border',
  published: 'badge-green border',
}

// ─────────────────────────────────────────────────────────────
// Stacked avatars
// ─────────────────────────────────────────────────────────────
const MAX_VISIBLE_AVATARS = 3

function ParticipantAvatars({ minute }: { minute: MeetingMinuteForList }) {
  const participants = minute.participants ?? []
  const visible = participants.slice(0, MAX_VISIBLE_AVATARS)
  const extra = participants.length - MAX_VISIBLE_AVATARS

  if (participants.length === 0) return null

  return (
    <div className="flex items-center -space-x-2" aria-label="Participantes">
      {visible.map((p) => {
        const name = p.user?.name ?? '?'
        const initials = getInitials(name)
        const colorClass = getAvatarColor(name)
        return p.user?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.user_id}
            src={p.user.avatar_url}
            alt={name}
            title={name}
            className="w-6 h-6 rounded-full border-2 border-card object-cover"
          />
        ) : (
          <span
            key={p.user_id}
            title={name}
            className={cn(
              'w-6 h-6 rounded-full border-2 border-card flex items-center justify-center text-[9px] font-semibold',
              colorClass,
            )}
          >
            {initials}
          </span>
        )
      })}
      {extra > 0 && (
        <span className="w-6 h-6 rounded-full border-2 border-card flex items-center justify-center text-[9px] font-semibold bg-muted text-muted-foreground">
          +{extra}
        </span>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────────────────────
interface Props {
  minute: MeetingMinuteForList
  animationDelay?: number
}

export const MeetingMinuteCard = memo(function MeetingMinuteCard({
  minute,
  animationDelay = 0,
}: Props) {
  const router = useRouter()

  const statusBadgeClass = STATUS_BADGE[minute.status] ?? 'badge-gray border'
  const statusLabel = MEETING_STATUS_LABELS[minute.status] ?? minute.status

  const meetingDate = new Date(minute.meeting_date)
  const formattedDate = format(meetingDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  const relativeDate = formatDistanceToNow(meetingDate, { addSuffix: true, locale: ptBR })

  const actionItems = minute.action_items ?? []
  const totalItems = actionItems.length
  const doneItems = actionItems.filter((i) => i.status === 'done').length

  const participantCount = (minute.participants ?? []).length

  return (
    <article
      className="animate-fade-up"
      style={{ animationDelay: `${animationDelay}ms`, animationFillMode: 'backwards' }}
    >
      <button
        type="button"
        onClick={() => router.push(`/atas/${minute.id}`)}
        className="w-full text-left group"
        aria-label={`Ver ata: ${minute.title}`}
      >
        <div className="relative rounded-xl border bg-card p-4 flex flex-col gap-3 card-interactive">

          {/* ── Row 1: título + badge de status ── */}
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                {minute.title}
              </h3>
              {minute.summary && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {minute.summary}
                </p>
              )}
            </div>

            <span className={cn(
              'shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
              statusBadgeClass,
            )}>
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
              {statusLabel}
            </span>
          </div>

          {/* ── Row 2: data e local ── */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span title={relativeDate}>{formattedDate}</span>
            </div>
            {minute.location && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{minute.location}</span>
              </div>
            )}
          </div>

          {/* ── Row 3: participantes + action items ── */}
          <div className="flex items-center justify-between gap-3 border-t border-border pt-2.5 mt-0.5">
            <div className="flex items-center gap-2">
              <ParticipantAvatars minute={minute} />
              {participantCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  {participantCount} {participantCount === 1 ? 'participante' : 'participantes'}
                </span>
              )}
            </div>

            {totalItems > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <CheckSquare className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{doneItems}/{totalItems}</span>
              </div>
            )}
          </div>

          {/* ── Criado por ── */}
          {minute.creator && (
            <p className="text-[11px] text-muted-foreground/70">
              Por {minute.creator.name} · {relativeDate}
            </p>
          )}
        </div>
      </button>
    </article>
  )
})
