'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ArrowLeft, Pencil, Trash2, Calendar, Clock, MapPin,
  Users, Package, FileText, ChevronDown, Plus, ClipboardList
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { EventStatusBadge, STATUS_CONFIG } from '@/components/shared/event-status-badge'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { UserAvatar } from '@/components/shared/user-avatar'
import { ChecklistCard } from '@/components/features/checklists/checklist-card'
import { AddChecklistModal } from '@/components/features/checklists/add-checklist-modal'
import { PloomesEventDetails } from '@/components/features/ploomes/ploomes-event-details'
import { useEvent, useDeleteEvent, useChangeEventStatus } from '@/hooks/use-events'
import { useEventChecklists, useCreateChecklist } from '@/hooks/use-checklists'
import { useUsers } from '@/hooks/use-users'
import type { EventStatus } from '@/types/database.types'

const ALL_STATUSES = Object.keys(STATUS_CONFIG) as EventStatus[]

export default function EventoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { data: event, isLoading, isError } = useEvent(id)
  const deleteEvent = useDeleteEvent()
  const changeStatus = useChangeEventStatus()
  const { data: checklists = [], isLoading: checklistsLoading } = useEventChecklists(id)
  const createChecklist = useCreateChecklist()
  const { data: usersData = [] } = useUsers({ isActive: true })
  const users = usersData.map((u) => ({ id: u.id, name: u.name }))

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [addChecklistOpen, setAddChecklistOpen] = useState(false)

  // ─── Loading ───
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="w-5 h-5 rounded" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  // ─── Erro ───
  if (isError || !event) {
    return (
      <div className="space-y-4">
        <Link href="/eventos" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Voltar para eventos
        </Link>
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          Evento não encontrado ou erro ao carregar. Verifique o link e tente novamente.
        </div>
      </div>
    )
  }

  const formattedDate = format(new Date(`${event.date}T00:00:00`), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
  const formatTime = (t: string) => t.slice(0, 5)

  async function handleDelete() {
    await deleteEvent.mutateAsync(id)
    router.push('/eventos')
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Header */}
      <div className="flex items-start gap-3">
        <Link
          href="/eventos"
          className="mt-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label="Voltar para eventos"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <PageHeader
          title={event.title}
          actions={
            <div className="flex items-center gap-2">
              {/* Mudar status */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="inline-flex h-7 items-center gap-1.5 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <EventStatusBadge status={event.status} size="sm" showDot={false} className="border-0 p-0 bg-transparent" />
                  <ChevronDown className="w-3.5 h-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Mudar status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {ALL_STATUSES.filter((s) => s !== event.status).map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onClick={() => changeStatus.mutate({ id, status: s })}
                      >
                        <EventStatusBadge status={s} size="sm" className="pointer-events-none" />
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/eventos/${id}/editar`)}
              >
                <Pencil className="w-4 h-4 mr-1.5" />
                Editar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:border-destructive/30"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          }
        />
      </div>

      {/* Badge de status visível no mobile */}
      <div className="sm:hidden">
        <EventStatusBadge status={event.status} />
      </div>

      {/* Grid de cards de informação */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Card: Data e Horário */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data e Horário</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="capitalize">{formattedDate}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
              <span>{formatTime(event.start_time)} – {formatTime(event.end_time)}</span>
            </div>
          </div>
        </div>

        {/* Card: Cliente */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cliente</h3>
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">{event.client_name}</p>
            {event.birthday_person && (
              <p className="text-sm text-muted-foreground">
                Aniversariante: <span className="text-foreground">{event.birthday_person}</span>
                {event.birthday_age && <span> · {event.birthday_age} anos</span>}
              </p>
            )}
            {event.guest_count && (
              <p className="text-sm text-muted-foreground">
                <Users className="w-3.5 h-3.5 inline mr-1" />
                {event.guest_count} convidados
              </p>
            )}
          </div>
        </div>

        {/* Card: Detalhes */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Detalhes</h3>
          <div className="space-y-2">
            {event.event_type && (
              <div className="flex items-center gap-2 text-sm">
                <span className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                </span>
                {event.event_type.name}
              </div>
            )}
            {event.package && (
              <div className="flex items-center gap-2 text-sm">
                <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                Pacote {event.package.name}
              </div>
            )}
            {event.venue && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                {event.venue.name}
                {event.venue.capacity && <span className="text-muted-foreground"> · cap. {event.venue.capacity}</span>}
              </div>
            )}
            {!event.event_type && !event.package && !event.venue && (
              <p className="text-sm text-muted-foreground">Sem detalhes cadastrados</p>
            )}
          </div>
        </div>

        {/* Card: Observações */}
        {event.notes && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Observações</h3>
            <div className="flex items-start gap-2 text-sm">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-foreground whitespace-pre-wrap">{event.notes}</p>
            </div>
          </div>
        )}
      </div>

      {/* Seção: Dados do Ploomes (apenas se evento veio do CRM) */}
      {event.ploomes_deal_id && (
        <PloomesEventDetails event={event} />
      )}

      {/* Seção: Equipe */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Equipe Designada ({event.staff.length})
        </h3>
        {event.staff.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum funcionário designado para este evento.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {event.staff.map((s) => (
              <div key={s.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/40">
                <UserAvatar name={s.user.name} avatarUrl={s.user.avatar_url} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{s.user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.role_in_event}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Seção: Checklists */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Checklists ({checklists.length})
          </h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAddChecklistOpen(true)}
            className="h-7 text-xs gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar
          </Button>
        </div>

        {checklistsLoading && (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        )}

        {!checklistsLoading && checklists.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <ClipboardList className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhum checklist neste evento.</p>
            <Button size="sm" variant="outline" onClick={() => setAddChecklistOpen(true)}>
              Criar primeiro checklist
            </Button>
          </div>
        )}

        {!checklistsLoading && checklists.length > 0 && (
          <div className="space-y-2">
            {checklists.map((cl) => (
              <ChecklistCard key={cl.id} checklist={cl} />
            ))}
          </div>
        )}
      </div>

      <AddChecklistModal
        open={addChecklistOpen}
        onOpenChange={setAddChecklistOpen}
        users={users}
        loading={createChecklist.isPending}
        onConfirm={async ({ templateId, title, assignedTo, dueDate }) => {
          await createChecklist.mutateAsync({
            eventId: id,
            templateId,
            title,
            assignedTo: assignedTo || undefined,
            dueDate: dueDate || undefined,
          })
          setAddChecklistOpen(false)
        }}
      />

      {/* Confirm delete */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir evento?"
        description={`O evento "${event.title}" será excluído permanentemente. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deleteEvent.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
