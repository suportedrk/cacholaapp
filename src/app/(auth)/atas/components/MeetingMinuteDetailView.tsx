'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MoreHorizontal, Pencil, Trash2, Calendar, MapPin, User } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { UserAvatar } from '@/components/shared/user-avatar'
import { ParticipantsList } from './ParticipantsList'
import { ActionItemsChecklist } from './ActionItemsChecklist'
import { useDeleteMeetingMinute } from '@/hooks/use-meeting-minute-mutations'
import { MEETING_STATUS_LABELS } from '@/types/minutes'
import type { MeetingMinuteDetail } from '@/types/minutes'
import { cn } from '@/lib/utils'

interface MeetingMinuteDetailViewProps {
  minute:        MeetingMinuteDetail
  currentUserId: string
  canEdit:       boolean
  canDelete:     boolean
  isElevated:    boolean
}

const statusBadgeClass: Record<string, string> = {
  draft:     'badge-amber border',
  published: 'badge-green border',
}

export function MeetingMinuteDetailView({
  minute,
  currentUserId,
  canEdit,
  canDelete,
  isElevated,
}: MeetingMinuteDetailViewProps) {
  const router      = useRouter()
  const deleteMinute = useDeleteMeetingMinute()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const meetingDate = new Date(minute.meeting_date + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day:     'numeric',
    month:   'long',
    year:    'numeric',
  })

  const createdAt = new Date(minute.created_at).toLocaleDateString('pt-BR', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
  const updatedAt = new Date(minute.updated_at).toLocaleDateString('pt-BR', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  async function handleDelete() {
    await deleteMinute.mutateAsync(minute.id)
    router.push('/atas')
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/atas"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Todas as atas
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1 min-w-0">
          <span className={cn('inline-flex text-xs px-2 py-0.5 rounded-full font-medium', statusBadgeClass[minute.status] ?? 'badge-gray border')}>
            {MEETING_STATUS_LABELS[minute.status]}
          </span>
          <h1 className="text-2xl font-bold leading-tight break-words">{minute.title}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 shrink-0" />
              {meetingDate}
            </span>
            {minute.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 shrink-0" />
                {minute.location}
              </span>
            )}
          </div>
        </div>

        {/* Actions menu */}
        {(canEdit || canDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon" className="w-9 h-9 shrink-0">
                  <MoreHorizontal className="w-5 h-5" />
                  <span className="sr-only">Opções</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-44">
              {canEdit && (
                <>
                  <DropdownMenuItem
                    onClick={() => router.push(`/atas/${minute.id}/editar`)}
                    className="gap-2"
                  >
                    <Pencil className="w-4 h-4" />
                    Editar ata
                  </DropdownMenuItem>
                  {canDelete && <DropdownMenuSeparator />}
                </>
              )}
              {canDelete && (
                <DropdownMenuItem
                  onClick={() => setDeleteOpen(true)}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir ata
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Participants */}
      <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Participantes
        </h2>
        <ParticipantsList participants={minute.participants} />
      </section>

      {/* Summary */}
      {minute.summary && (
        <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Resumo
          </h2>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{minute.summary}</p>
        </section>
      )}

      {/* Notes */}
      {minute.notes && (
        <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Registro da Reunião
          </h2>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{minute.notes}</p>
        </section>
      )}

      {/* Action items */}
      <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Itens de Ação
        </h2>
        <ActionItemsChecklist
          items={minute.action_items}
          meetingId={minute.id}
          currentUserId={currentUserId}
          canToggleAll={isElevated || minute.created_by === currentUserId}
        />
      </section>

      {/* Footer — created by + timestamps */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground border-t pt-4">
        {minute.creator && (
          <span className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            Criado por {minute.creator.name}
          </span>
        )}
        <span>Criado em {createdAt}</span>
        {updatedAt !== createdAt && <span>Atualizado em {updatedAt}</span>}
      </div>

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir ata"
        description={`Tem certeza que deseja excluir "${minute.title}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        destructive
        loading={deleteMinute.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
