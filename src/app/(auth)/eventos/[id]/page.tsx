'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ArrowLeft, Pencil, Trash2, Calendar, Clock, MapPin,
  Users, Package, FileText, ChevronDown, Plus, ClipboardList,
  ExternalLink, Wrench,
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
import { EventStatusBadge, STATUS_CONFIG } from '@/components/shared/event-status-badge'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { UserAvatar } from '@/components/shared/user-avatar'
import { ChecklistCard } from '@/components/features/checklists/checklist-card'
import { AddChecklistModal } from '@/components/features/checklists/add-checklist-modal'
import { PloomesEventDetails } from '@/components/features/ploomes/ploomes-event-details'
import { EventTimeline } from '@/components/features/events/event-timeline'
import { MaintenanceStatusBadge, MaintenancePriorityBadge } from '@/components/features/maintenance/maintenance-status-badge'
import { useEvent, useDeleteEvent, useChangeEventStatus } from '@/hooks/use-events'
import { useEventChecklists, useCreateChecklist } from '@/hooks/use-checklists'
import { useEventMaintenances } from '@/hooks/use-maintenance'
import { useUsers } from '@/hooks/use-users'
import { cn } from '@/lib/utils'
import type { EventStatus } from '@/types/database.types'

const ALL_STATUSES = Object.keys(STATUS_CONFIG) as EventStatus[]

// ─────────────────────────────────────────────────────────────
// INFO CARD
// ─────────────────────────────────────────────────────────────
function InfoCard({
  title,
  children,
  filled,
  className,
}: {
  title: string
  children: React.ReactNode
  filled?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4 space-y-3',
        filled
          ? 'bg-brand-50 border-primary/20 dark:bg-brand-900/20 dark:border-primary/30'
          : 'bg-card border-border',
        className,
      )}
    >
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </h3>
      {children}
    </div>
  )
}

function InfoRow({
  icon: Icon,
  children,
}: {
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
      <span className="text-foreground">{children}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SECTION HEADER
// ─────────────────────────────────────────────────────────────
function SectionHeader({
  title,
  count,
  action,
}: {
  title: string
  count?: number
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
        {title}
        {count !== undefined && (
          <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
            {count}
          </span>
        )}
      </h2>
      {action}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────
export default function EventoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { data: event, isLoading, isError } = useEvent(id)
  const deleteEvent = useDeleteEvent()
  const changeStatus = useChangeEventStatus()
  const { data: checklists = [], isLoading: checklistsLoading } = useEventChecklists(id)
  const { data: maintenances = [] } = useEventMaintenances(id)
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
          <Skeleton className="h-8 w-56" />
        </div>
        <Skeleton className="h-28 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-56 rounded-xl" />
      </div>
    )
  }

  // ─── Erro ───
  if (isError || !event) {
    return (
      <div className="space-y-4">
        <Link
          href="/eventos"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para eventos
        </Link>
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          Evento não encontrado ou erro ao carregar.
        </div>
      </div>
    )
  }

  const formattedDate = format(
    parseISO(`${event.date}T00:00:00`),
    "EEEE, d 'de' MMMM 'de' yyyy",
    { locale: ptBR },
  )
  const formatTime = (t: string) => t.slice(0, 5)

  async function handleDelete() {
    await deleteEvent.mutateAsync(id)
    router.push('/eventos')
  }

  return (
    <div className="space-y-6">

      {/* ── Top nav: actions ── */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 ml-auto">
          {/* Status changer */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            <Pencil className="w-4 h-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Editar</span>
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
      </div>

      {/* ── Hero Header ── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        {/* Title row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground leading-tight">{event.title}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{event.client_name}</p>
          </div>
          {event.ploomes_url && (
            <a
              href={event.ploomes_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 shrink-0 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 transition-colors hover:bg-muted"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ploomes</span>
            </a>
          )}
        </div>

        {/* Badge strip */}
        <div className="flex flex-wrap items-center gap-2">
          <EventStatusBadge status={event.status} />
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 rounded-full px-2.5 py-1">
            <Calendar className="w-3 h-3" />
            <span className="capitalize">{format(parseISO(`${event.date}T00:00:00`), "d 'de' MMM 'de' yyyy", { locale: ptBR })}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 rounded-full px-2.5 py-1">
            <Clock className="w-3 h-3" />
            {formatTime(event.start_time)} – {formatTime(event.end_time)}
          </span>
          {event.venue && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 rounded-full px-2.5 py-1">
              <MapPin className="w-3 h-3" />
              {event.venue.name}
            </span>
          )}
          {event.guest_count && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 rounded-full px-2.5 py-1">
              <Users className="w-3 h-3" />
              {event.guest_count} convidados
            </span>
          )}
        </div>
      </div>

      {/* ── Info Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Dados do Cliente */}
        <InfoCard title="Dados do Cliente">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">{event.client_name}</p>
            {event.birthday_person && (
              <p className="text-sm text-muted-foreground">
                Aniversariante:{' '}
                <span className="text-foreground font-medium">{event.birthday_person}</span>
                {event.birthday_age && <span> · {event.birthday_age} anos</span>}
              </p>
            )}
            {event.guest_count && (
              <InfoRow icon={Users}>
                {event.guest_count} convidados esperados
              </InfoRow>
            )}
          </div>
        </InfoCard>

        {/* Dados da Festa */}
        <InfoCard title="Dados da Festa">
          <div className="space-y-2">
            <InfoRow icon={Calendar}>
              <span className="capitalize">{formattedDate}</span>
            </InfoRow>
            <InfoRow icon={Clock}>
              {formatTime(event.start_time)} – {formatTime(event.end_time)}
            </InfoRow>
            {event.event_type && (
              <InfoRow icon={Package}>
                {event.event_type.name}
              </InfoRow>
            )}
            {event.package && (
              <InfoRow icon={Package}>
                Pacote {event.package.name}
              </InfoRow>
            )}
            {event.venue && (
              <InfoRow icon={MapPin}>
                {event.venue.name}
                {event.venue.capacity && (
                  <span className="text-muted-foreground"> · cap. {event.venue.capacity}</span>
                )}
              </InfoRow>
            )}
          </div>
        </InfoCard>

        {/* Observações */}
        {event.notes && (
          <InfoCard title="Observações" className="md:col-span-2">
            <InfoRow icon={FileText}>
              <span className="whitespace-pre-wrap">{event.notes}</span>
            </InfoRow>
          </InfoCard>
        )}
      </div>

      {/* ── Ploomes ── */}
      {event.ploomes_deal_id && (
        <PloomesEventDetails event={event} />
      )}

      {/* ── Linha do Tempo ── */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
        <SectionHeader title="Linha do Tempo" />
        <EventTimeline event={event} checklists={checklists} />
      </div>

      {/* ── Checklists ── */}
      <div className="bg-card border border-border rounded-xl p-4">
        <SectionHeader
          title="Checklists"
          count={checklists.length}
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddChecklistOpen(true)}
              className="h-7 text-xs gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </Button>
          }
        />

        {checklistsLoading && (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        )}

        {!checklistsLoading && checklists.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
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

      {/* ── Manutenções Relacionadas ── */}
      {maintenances.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <SectionHeader title="Manutenções Relacionadas" count={maintenances.length} />
          <div className="space-y-2">
            {maintenances.map((m) => (
              <Link
                key={m.id}
                href={`/manutencao/${m.id}`}
                className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors card-interactive"
              >
                <div className="mt-0.5 p-1.5 rounded-md bg-muted shrink-0">
                  <Wrench className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{m.title}</p>
                  {m.sector && (
                    <p className="text-xs text-muted-foreground">{m.sector.name}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <MaintenanceStatusBadge status={m.status} />
                  <MaintenancePriorityBadge priority={m.priority} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Equipe ── */}
      <div className="bg-card border border-border rounded-xl p-4">
        <SectionHeader title="Equipe Designada" count={event.staff.length} />
        {event.staff.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum funcionário designado.</p>
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

      {/* Modals */}
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
