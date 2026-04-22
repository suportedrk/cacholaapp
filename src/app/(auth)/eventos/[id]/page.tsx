'use client'

import { useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ArrowLeft, Calendar, Clock, MapPin, Users,
  Plus, ExternalLink, Wrench, PartyPopper, Truck, User2, User,
  CheckSquare, MessageCircle, Phone, Mail,
  ClipboardList, History, Tag, Star, Camera, Music2, CakeSlice,
  DollarSign, School, BookText, Check, X as XIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EventStatusBadge } from '@/components/shared/event-status-badge'
import { UserAvatar } from '@/components/shared/user-avatar'
import { CreateChecklistModal } from '@/app/(auth)/checklists/components/create-checklist-modal'
import { EventTimeline } from '@/components/features/events/event-timeline'
import { MaintenanceStatusBadge, MaintenancePriorityBadge } from '@/components/features/maintenance/maintenance-status-badge'
import { useEvent } from '@/hooks/use-events'
import { useEventChecklists } from '@/hooks/use-checklists'
import { useEventMaintenances } from '@/hooks/use-maintenance'
import { AccordionSection } from './components/AccordionSection'
import { ProvidersSection } from './components/sections/ProvidersSection'
import { EventSalesSection } from './components/sections/EventSalesSection'
import { cn } from '@/lib/utils'
import type { ChecklistForList } from '@/types/database.types'

// ── Avatar helpers ──────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-primary text-white',
  'bg-blue-500 text-white',
  'bg-violet-500 text-white',
  'bg-amber-600 text-white',
  'bg-rose-500 text-white',
  'bg-teal-600 text-white',
  'bg-orange-500 text-white',
  'bg-indigo-500 text-white',
]

function getAvatarColor(name: string): string {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// AccordionSection — imported from ./components/AccordionSection

// ── Logistics Timeline ─────────────────────────────────────────
interface TimelinePoint {
  time: string
  label: string
  color: string
  textColor: string
}

function LogisticsTimeline({
  start, end, setup, teardown, show,
}: {
  start: string
  end: string
  setup?: string | null
  teardown?: string | null
  show?: string | null
}) {
  const fmt = (t: string) => t.slice(0, 5)

  const raw: Array<TimelinePoint & { sortKey: string }> = [
    ...(setup    ? [{ sortKey: setup,    time: fmt(setup),    label: 'Montagem',    color: 'bg-amber-400',  textColor: 'text-amber-600 dark:text-amber-400' }] : []),
    { sortKey: start,    time: fmt(start),    label: 'Início',     color: 'bg-green-500', textColor: 'text-green-600 dark:text-green-400' },
    ...(show     ? [{ sortKey: show,     time: fmt(show),     label: 'Show',        color: 'bg-violet-500', textColor: 'text-violet-600 dark:text-violet-400' }] : []),
    { sortKey: end,      time: fmt(end),      label: 'Término',    color: 'bg-green-500', textColor: 'text-green-600 dark:text-green-400' },
    ...(teardown ? [{ sortKey: teardown, time: fmt(teardown), label: 'Desmontagem', color: 'bg-amber-400',  textColor: 'text-amber-600 dark:text-amber-400' }] : []),
  ]
  // Sort by sortKey (HH:MM comparison works lexicographically)
  const points = raw.sort((a, b) => a.sortKey.localeCompare(b.sortKey))

  return (
    <div className="relative flex items-start justify-between pt-5 pb-2">
      <div className="absolute top-[13px] left-[18px] right-[18px] h-0.5 bg-border" />
      {points.map((pt, idx) => (
        <div key={idx} className="flex flex-col items-center gap-1 relative z-10">
          <div className={cn('w-3 h-3 rounded-full ring-2 ring-card', pt.color)} />
          <span className={cn('text-xs font-semibold tabular-nums', pt.textColor)}>{pt.time}</span>
          <span className="text-[10px] text-text-tertiary">{pt.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Bool indicator helper ──────────────────────────────────────
function BoolIndicator({ value, label }: { value: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {value ? (
        <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
      ) : (
        <XIcon className="w-3.5 h-3.5 text-text-tertiary/40 shrink-0" />
      )}
      <span className={cn('text-sm', value ? 'text-text-primary' : 'text-text-tertiary line-through')}>{label}</span>
    </div>
  )
}

// ── Checklist Row ──────────────────────────────────────────────
function EventChecklistRow({ checklist }: { checklist: ChecklistForList }) {
  const items = checklist.checklist_items ?? []
  const total = items.length
  const done  = items.filter((i) => i.status === 'done').length
  const pct   = total > 0
    ? Math.round((done / total) * 100)
    : (checklist.status === 'completed' ? 100 : 0)
  const isCompleted = checklist.status === 'completed'
  const barColor    = isCompleted || pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <Link
      href={`/checklists/${checklist.id}`}
      className="flex items-center gap-3 py-2.5 border-b border-border last:border-b-0 -mx-4 px-4 hover:bg-muted/30 transition-colors"
    >
      {isCompleted ? (
        <CheckSquare className="w-4 h-4 text-green-500 shrink-0" />
      ) : (
        <div className="w-4 h-4 rounded border-2 border-border shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary truncate">{checklist.title}</p>
        {total > 0 && (
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
              <div className={cn('h-full rounded-full', barColor)} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] text-text-tertiary tabular-nums shrink-0">{pct}%</span>
          </div>
        )}
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
    </Link>
  )
}

// ── Mobile Quick Actions Bar ───────────────────────────────────
function QuickActionsBar({
  phone,
  ploomesUrl,
  onChecklistsClick,
}: {
  phone?: string | null
  ploomesUrl?: string | null
  onChecklistsClick: () => void
}) {
  const cleanPhone = phone?.replace(/\D/g, '') ?? ''

  return (
    <div
      className="fixed bottom-0 inset-x-0 md:hidden z-[25] bg-surface-primary border-t border-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around px-2 py-3">
        {phone ? (
          <a
            href={`tel:${cleanPhone}`}
            className="flex flex-col items-center gap-1 px-3 py-1 rounded-lg hover:bg-muted/40 transition-colors"
          >
            <Phone className="w-5 h-5 text-text-secondary" />
            <span className="text-[10px] text-text-tertiary">Ligar</span>
          </a>
        ) : (
          <div className="flex flex-col items-center gap-1 px-3 py-1 opacity-30">
            <Phone className="w-5 h-5 text-text-secondary" />
            <span className="text-[10px] text-text-tertiary">Ligar</span>
          </div>
        )}

        {phone ? (
          <a
            href={`https://wa.me/55${cleanPhone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 px-3 py-1 rounded-lg hover:bg-muted/40 transition-colors"
          >
            <MessageCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span className="text-[10px] text-text-tertiary">WhatsApp</span>
          </a>
        ) : (
          <div className="flex flex-col items-center gap-1 px-3 py-1 opacity-30">
            <MessageCircle className="w-5 h-5 text-text-secondary" />
            <span className="text-[10px] text-text-tertiary">WhatsApp</span>
          </div>
        )}

        <button
          type="button"
          onClick={onChecklistsClick}
          className="flex flex-col items-center gap-1 px-3 py-1 rounded-lg hover:bg-muted/40 transition-colors"
        >
          <CheckSquare className="w-5 h-5 text-text-secondary" />
          <span className="text-[10px] text-text-tertiary">Checklists</span>
        </button>

        {ploomesUrl ? (
          <a
            href={ploomesUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 px-3 py-1 rounded-lg hover:bg-muted/40 transition-colors"
          >
            <ExternalLink className="w-5 h-5 text-blue-500" />
            <span className="text-[10px] text-text-tertiary">Ploomes</span>
          </a>
        ) : null}
      </div>
    </div>
  )
}

// ── Loading skeleton ───────────────────────────────────────────
function EventDetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-5 w-36 hidden sm:block" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>
      <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-4">
          <Skeleton className="w-16 h-16 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-5 w-24 rounded-full mt-1" />
            <Skeleton className="h-4 w-1/2 mt-1" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-4" />)}
        </div>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2.5 px-4 py-3.5">
            <Skeleton className="w-4 h-4 rounded" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="w-4 h-4 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────
export default function EventoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const { data: event, isLoading, isError } = useEvent(id)
  const { data: checklists = [], isLoading: checklistsLoading } = useEventChecklists(id)
  const { data: maintenances = [] } = useEventMaintenances(id)

  const [addChecklistOpen, setAddChecklistOpen] = useState(false)

  const checklistsSectionRef = useRef<HTMLDivElement | null>(null)

  function scrollToChecklists() {
    checklistsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ── Loading ──
  if (isLoading) return <EventDetailSkeleton />

  // ── Erro / não encontrado ──
  if (isError || !event) {
    return (
      <div className="space-y-4">
        <Link
          href="/eventos"
          className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para eventos
        </Link>
        <div className="p-4 rounded-lg bg-status-error-bg border border-status-error-border text-sm text-status-error-text">
          Evento não encontrado ou erro ao carregar.{' '}
          <button
            type="button"
            onClick={() => router.push('/eventos')}
            className="underline underline-offset-2"
          >
            Ver todos os eventos
          </button>
        </div>
      </div>
    )
  }

  // ── Dados derivados ──
  const formattedDate = format(
    parseISO(`${event.date}T00:00:00`),
    "EEE, d 'de' MMMM 'de' yyyy",
    { locale: ptBR },
  )

  const displayTitle = event.birthday_person
    ? `${event.birthday_person}${event.birthday_age ? ` · ${event.birthday_age} anos` : ''}`
    : event.title

  const avatarName     = event.birthday_person || event.client_name || '?'
  const avatarColor    = getAvatarColor(avatarName)
  const avatarInitials = getInitials(avatarName)

  const completedChecklists = checklists.filter((c) => c.status === 'completed').length

  const hasPartyInfo  = !!(event.notes || event.event_category || event.cake_flavor || event.music || event.adult_count || event.kids_under4 || event.kids_over5)
  const hasClientInfo = !!(event.client_phone || event.client_email || event.father_name || event.school || event.birthday_date)
  const hasLogisticsExtras = !!(event.setup_time || event.teardown_time || event.show_time)
  const hasServices   = event.has_show || event.decoration_aligned || event.has_decorated_sweets || event.party_favors || event.outside_drinks || !!event.photo_video
  const hasBriefing   = !!event.briefing
  const hasFinancial  = !!(event.deal_amount || event.payment_method)

  function formatBRL(val: number) {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }
  function formatTime(t: string) { return t.slice(0, 5) }

  const ploomesUrl = event.ploomes_deal_id
    ? `https://app10.ploomes.com/deal/${event.ploomes_deal_id}`
    : event.ploomes_url

  return (
    <div className="space-y-4 pb-20 md:pb-0">

      {/* ── Top nav: back + breadcrumb + actions ── */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors shrink-0"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="hidden sm:inline text-text-tertiary text-sm">/</span>
        <Link href="/eventos" className="hidden sm:inline text-sm text-text-secondary hover:text-text-primary transition-colors">
          Eventos
        </Link>
        <span className="hidden sm:inline text-text-tertiary text-sm">/</span>
        <span className="hidden sm:inline text-sm text-text-primary font-medium truncate max-w-[220px]">
          {displayTitle}
        </span>

        <div className="flex items-center gap-2 ml-auto shrink-0">
          {ploomesUrl && (
            <a
              href={ploomesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary border border-border rounded-lg px-2.5 py-1.5 transition-colors hover:bg-muted"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Ploomes
            </a>
          )}
        </div>
      </div>

      {/* ── Hero Header ── */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
        <div className="flex flex-col md:grid md:grid-cols-[1fr_auto] md:gap-8">

          {/* Left: identidade */}
          <div className="flex items-start gap-3 sm:gap-4">
            <div className={cn(
              'w-16 h-16 rounded-full shrink-0 flex items-center justify-center text-lg font-bold',
              avatarColor
            )}>
              {avatarInitials}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-text-primary leading-tight">
                {displayTitle}
              </h1>
              {event.theme && (
                <div className="flex items-center gap-1 mt-1">
                  <Tag className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
                  <span className="text-sm text-text-secondary">{event.theme}</span>
                </div>
              )}
              <div className="mt-2">
                <EventStatusBadge status={event.status} />
              </div>
              <div className="mt-3">
                <p className="text-sm font-medium text-text-primary">{event.client_name}</p>
                {event.client_phone && (
                  <a
                    href={`tel:${event.client_phone.replace(/\D/g, '')}`}
                    className="inline-flex items-center gap-1 mt-0.5 text-xs text-text-link hover:underline"
                  >
                    <Phone className="w-3 h-3 shrink-0" />
                    {event.client_phone}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Right: dados logísticos */}
          <div className="mt-4 md:mt-0 grid grid-cols-2 md:grid-cols-1 gap-y-2 gap-x-4 text-sm text-text-secondary md:min-w-[190px]">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 shrink-0 text-text-tertiary" />
              <span className="capitalize leading-tight">{formattedDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 shrink-0 text-text-tertiary" />
              <span>{formatTime(event.start_time)} – {formatTime(event.end_time)}</span>
            </div>
            {event.guest_count && (
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 shrink-0 text-text-tertiary" />
                <span>{event.guest_count} convidados</span>
              </div>
            )}
            {event.owner_name && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 shrink-0 text-text-tertiary" />
                <span>{event.owner_name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Accordion Sections ── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">

        {/* S1: Informações da Festa */}
        {hasPartyInfo && (
          <AccordionSection title="Informações da Festa" icon={PartyPopper} defaultOpen>
            <div className="space-y-2.5">
              {event.event_category && (
                <div className="flex items-start gap-3">
                  <span className="text-xs text-text-tertiary w-28 shrink-0 pt-0.5">Tipo</span>
                  <span className="text-sm text-text-primary">{event.event_category}</span>
                </div>
              )}
              {/* Convidados */}
              {event.guest_count && (
                <div className="flex items-start gap-3">
                  <span className="text-xs text-text-tertiary w-28 shrink-0 pt-0.5">Convidados</span>
                  <div>
                    <span className="text-sm text-text-primary">{event.guest_count} pessoas</span>
                    {!!(event.adult_count || event.kids_under4 || event.kids_over5) && (
                      <p className="text-xs text-text-tertiary mt-0.5">
                        {[
                          event.adult_count ? `${event.adult_count} adultos` : null,
                          event.kids_over5  ? `${event.kids_over5} crianças ≥5` : null,
                          event.kids_under4 ? `${event.kids_under4} crianças ≤4` : null,
                        ].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {/* Bolo e música */}
              {event.cake_flavor && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-tertiary w-28 shrink-0">Sabor do bolo</span>
                  <div className="flex items-center gap-1.5">
                    <CakeSlice className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
                    <span className="text-sm text-text-primary">{event.cake_flavor}</span>
                  </div>
                </div>
              )}
              {event.music && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-tertiary w-28 shrink-0">Músicas</span>
                  <div className="flex items-center gap-1.5">
                    <Music2 className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
                    <span className="text-sm text-text-primary">{event.music}</span>
                  </div>
                </div>
              )}
              {event.notes && (
                <div className="mt-1 pt-3 border-t border-border">
                  <p className="text-xs text-text-tertiary mb-1.5">Observações</p>
                  <p className="text-sm text-text-secondary whitespace-pre-wrap">{event.notes}</p>
                </div>
              )}
            </div>
          </AccordionSection>
        )}

        {/* S2: Logística */}
        <AccordionSection title="Logística" icon={Truck} defaultOpen>
          <LogisticsTimeline
            start={event.start_time}
            end={event.end_time}
            setup={hasLogisticsExtras ? event.setup_time : null}
            teardown={hasLogisticsExtras ? event.teardown_time : null}
            show={hasLogisticsExtras ? event.show_time : null}
          />
          <div className="mt-2 space-y-1.5 text-sm">
            {event.event_location && (
              <div className="flex items-center gap-2 text-text-secondary">
                <MapPin className="w-4 h-4 text-text-tertiary shrink-0" />
                <span>{event.event_location}</span>
              </div>
            )}
          </div>
        </AccordionSection>

        {/* S3: Cliente e Contato */}
        <AccordionSection title="Cliente e Família" icon={User2}>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-text-primary">{event.client_name}</p>
              {event.birthday_person && (
                <p className="text-xs text-text-tertiary mt-0.5">
                  Aniversariante:{' '}
                  <span className="text-text-secondary">
                    {event.birthday_person}
                    {event.birthday_age ? ` · ${event.birthday_age} anos` : ''}
                    {event.birthday_date ? ` (${format(parseISO(event.birthday_date + 'T00:00:00'), 'dd/MM/yyyy')})` : ''}
                  </span>
                </p>
              )}
              {event.father_name && (
                <p className="text-xs text-text-tertiary mt-0.5">
                  Pai: <span className="text-text-secondary">{event.father_name}</span>
                </p>
              )}
              {event.school && (
                <div className="flex items-center gap-1.5 mt-1">
                  <School className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
                  <span className="text-xs text-text-secondary">{event.school}</span>
                </div>
              )}
            </div>

            {hasClientInfo && (
              <div className="flex flex-wrap gap-2">
                {event.client_phone && (
                  <>
                    <a
                      href={`tel:${event.client_phone.replace(/\D/g, '')}`}
                      className="inline-flex items-center gap-1.5 text-xs rounded-lg border border-border px-3 py-1.5 hover:bg-muted/50 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      Ligar
                    </a>
                    <a
                      href={`https://wa.me/55${event.client_phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs rounded-lg border border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400 px-3 py-1.5 hover:opacity-80 transition-opacity"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      WhatsApp
                    </a>
                  </>
                )}
                {event.client_email && (
                  <a
                    href={`mailto:${event.client_email}`}
                    className="inline-flex items-center gap-1.5 text-xs rounded-lg border border-border px-3 py-1.5 hover:bg-muted/50 transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    E-mail
                  </a>
                )}
              </div>
            )}

            {event.client_phone && (
              <p className="text-xs text-text-tertiary">{event.client_phone}</p>
            )}
            {event.client_email && (
              <p className="text-xs text-text-tertiary">{event.client_email}</p>
            )}
          </div>
        </AccordionSection>

        {/* S3b: Serviços Contratados */}
        {hasServices && (
          <AccordionSection title="Serviços Contratados" icon={Star}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              <BoolIndicator value={event.has_show}            label="Show" />
              <BoolIndicator value={event.decoration_aligned}  label="Decoração alinhada" />
              <BoolIndicator value={event.has_decorated_sweets} label="Doces decorados" />
              <BoolIndicator value={event.party_favors}        label="Lembrancinhas" />
              <BoolIndicator value={event.outside_drinks}      label="Bebidas de fora" />
              {event.photo_video && (
                <div className="flex items-center gap-2">
                  <Camera className="w-3.5 h-3.5 text-text-secondary shrink-0" />
                  <span className="text-sm text-text-primary">{event.photo_video}</span>
                </div>
              )}
            </div>
          </AccordionSection>
        )}

        {/* S3c: Briefing */}
        {hasBriefing && (
          <AccordionSection title="Briefing" icon={BookText}>
            <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">{event.briefing}</p>
          </AccordionSection>
        )}

        {/* S3d: Financeiro */}
        {hasFinancial && (
          <AccordionSection title="Financeiro" icon={DollarSign}>
            <div className="space-y-2">
              {event.deal_amount != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">Valor do negócio</span>
                  <span className="text-sm font-semibold text-text-primary">{formatBRL(event.deal_amount)}</span>
                </div>
              )}
              {event.payment_method && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">Forma de pagamento</span>
                  <span className="text-sm text-text-primary">{event.payment_method}</span>
                </div>
              )}
            </div>
          </AccordionSection>
        )}

        {/* S3e: Vendas */}
        <EventSalesSection eventId={id} />

        {/* S4: Prestadores */}
        <ProvidersSection eventId={id} eventDate={event.date} eventTitle={event.birthday_person || event.title || ''} />

        {/* S5: Checklists */}
        <div ref={checklistsSectionRef}>
          <AccordionSection
            title="Checklists"
            icon={CheckSquare}
            badge={checklists.length > 0 ? `${completedChecklists}/${checklists.length}` : undefined}
            defaultOpen
          >
            {checklistsLoading && (
              <div className="space-y-2">
                {[1, 2].map((i) => <Skeleton key={i} className="h-10 rounded" />)}
              </div>
            )}

            {!checklistsLoading && checklists.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <ClipboardList className="w-7 h-7 text-text-tertiary/40" />
                <p className="text-sm text-text-secondary">Nenhum checklist neste evento.</p>
              </div>
            )}

            {!checklistsLoading && checklists.length > 0 && (
              <div>
                {checklists.map((cl) => (
                  <EventChecklistRow key={cl.id} checklist={cl as ChecklistForList} />
                ))}
              </div>
            )}

            <Button
              size="sm"
              variant="outline"
              className="w-full mt-3 gap-1.5"
              onClick={() => setAddChecklistOpen(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              Criar Checklist
            </Button>
          </AccordionSection>
        </div>

        {/* S5: Equipe */}
        {(event.staff ?? []).length > 0 && (
          <AccordionSection
            title="Equipe Designada"
            icon={Users}
            badge={(event.staff ?? []).length}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(event.staff ?? []).map((s) => (
                <div key={s.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/40">
                  <UserAvatar name={s.user.name} avatarUrl={s.user.avatar_url} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{s.user.name}</p>
                    <p className="text-xs text-text-tertiary truncate">{s.role_in_event}</p>
                  </div>
                </div>
              ))}
            </div>
          </AccordionSection>
        )}

        {/* S6: Manutenções Relacionadas */}
        {maintenances.length > 0 && (
          <AccordionSection
            title="Manutenções Relacionadas"
            icon={Wrench}
            badge={maintenances.length}
          >
            <div className="space-y-2">
              {maintenances.map((m) => (
                <Link
                  key={m.id}
                  href={`/manutencao/${m.id}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/40 transition-colors card-interactive"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{m.title}</p>
                    {m.sector && <p className="text-xs text-text-tertiary">{m.sector.name}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <MaintenanceStatusBadge status={m.status} />
                    <MaintenancePriorityBadge priority={m.priority} />
                  </div>
                </Link>
              ))}
            </div>
          </AccordionSection>
        )}

        {/* S7: Histórico */}
        <AccordionSection title="Histórico" icon={History}>
          <EventTimeline event={event} checklists={checklists} />
        </AccordionSection>

      </div>

      {/* Modals */}
      <CreateChecklistModal
        open={addChecklistOpen}
        onClose={() => setAddChecklistOpen(false)}
        defaultEventId={id}
        defaultEventTitle={event.title}
        onCreated={() => setAddChecklistOpen(false)}
      />

      {/* Mobile Quick Actions */}
      <QuickActionsBar
        phone={event.client_phone}
        ploomesUrl={ploomesUrl}
        onChecklistsClick={scrollToChecklists}
      />
    </div>
  )
}
