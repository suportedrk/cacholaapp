'use client'

import { useState, useMemo, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, LayoutList, LayoutGrid, Wrench,
  Clock, AlertTriangle, CheckCircle2, ClipboardList,
} from 'lucide-react'
import { startOfMonth } from 'date-fns'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useTickets, type TicketFilters } from '@/hooks/use-tickets'
import { useSectors } from '@/hooks/use-sectors'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { TicketCard, TicketCardSkeleton } from '@/components/features/maintenance/ticket-card'
import { TicketFormModal } from '@/components/features/maintenance/ticket-form-modal'
import { TicketKanbanBoard } from '@/components/features/maintenance/ticket-kanban-board'
import type { TicketNature, TicketUrgency, TicketStatus } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────
type ViewMode = 'list' | 'kanban'
const VIEW_KEY = 'maintenance-view-mode'

// ─────────────────────────────────────────────────────────────
// KPI CARD
// ─────────────────────────────────────────────────────────────
function KpiCard({
  icon: Icon,
  label,
  value,
  colorClass,
  isLoading,
}: {
  icon:       React.ElementType
  label:      string
  value:      number
  colorClass: string
  isLoading:  boolean
}) {
  return (
    <div className={cn(
      'bg-card rounded-xl border border-border p-4 flex items-center gap-3',
      value > 0 && colorClass === 'text-red-500' && 'border-red-200 bg-red-50/40 dark:border-red-900/30 dark:bg-red-950/10',
    )}>
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center bg-muted', colorClass.replace('text-', 'text-'))}>
        <Icon className={cn('w-4.5 h-4.5', colorClass)} />
      </div>
      <div>
        {isLoading ? (
          <div className="h-6 w-8 skeleton-shimmer rounded mb-0.5" />
        ) : (
          <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
        )}
        <p className="text-xs text-text-secondary">{label}</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// VIEW TOGGLE
// ─────────────────────────────────────────────────────────────
function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="hidden md:flex items-center gap-0.5 bg-muted rounded-lg p-0.5 shrink-0">
      {([
        { id: 'list',   Icon: LayoutList, label: 'Lista'  },
        { id: 'kanban', Icon: LayoutGrid, label: 'Kanban' },
      ] as const).map(({ id, Icon, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
            mode === id
              ? 'bg-card text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE CONTENT
// ─────────────────────────────────────────────────────────────
function ChamadosContent() {
  const router = useRouter()

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [modalOpen, setModalOpen] = useState(false)
  const [search, setSearch]       = useState('')
  const [sectorId, setSectorId]   = useState('')
  const [urgency, setUrgency]     = useState<TicketUrgency | ''>('')
  const [nature, setNature]       = useState<TicketNature | ''>('')

  // Restore view preference
  useEffect(() => {
    const saved = localStorage.getItem(VIEW_KEY)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === 'kanban' || saved === 'list') setViewMode(saved)
  }, [])

  function changeView(m: ViewMode) {
    setViewMode(m)
    localStorage.setItem(VIEW_KEY, m)
  }

  const { data: sectors = [] } = useSectors(true)

  // Fetch ALL tickets for KPI calculation (no status filter)
  const { data: allTickets = [], isLoading } = useTickets({})
  const { isTimedOut, retry } = useLoadingTimeout(isLoading)

  // ── KPIs (client-side) ────────────────────────────────────
  const kpis = useMemo(() => {
    const now      = Date.now()
    const monthStart = startOfMonth(new Date()).getTime()

    let open       = 0
    let inProgress = 0
    let overdue    = 0
    let concluded  = 0

    for (const t of allTickets) {
      if (t.status === 'open')        open++
      if (t.status === 'in_progress') inProgress++
      if (
        t.due_at &&
        t.status !== 'concluded' &&
        t.status !== 'cancelled' &&
        new Date(t.due_at).getTime() < now
      ) overdue++
      if (
        t.status === 'concluded' &&
        t.concluded_at &&
        new Date(t.concluded_at).getTime() >= monthStart
      ) concluded++
    }

    return { open, inProgress, overdue, concluded }
  }, [allTickets])

  // ── Filters for display ───────────────────────────────────
  const activeFilters = useMemo<TicketFilters>(() => ({
    search:   search || undefined,
    urgency:  urgency ? [urgency as TicketUrgency] : undefined,
    nature:   nature  ? [nature  as TicketNature]  : undefined,
    sectorId: sectorId || undefined,
    pageSize: 500,
  }), [search, urgency, nature, sectorId])

  // In kanban mode: use same allTickets filtered client-side
  // In list mode: filtered tickets via client-side filter of allTickets
  const displayTickets = useMemo(() => {
    if (viewMode === 'kanban') return allTickets
    return allTickets.filter((t) => {
      if (t.status === 'cancelled')                    return false
      if (activeFilters.search) {
        const q = activeFilters.search.toLowerCase()
        if (!t.title.toLowerCase().includes(q) &&
            !(t.description ?? '').toLowerCase().includes(q)) return false
      }
      if (activeFilters.urgency?.length && !activeFilters.urgency.includes(t.urgency)) return false
      if (activeFilters.nature?.length  && !activeFilters.nature.includes(t.nature))   return false
      if (activeFilters.sectorId && t.sector_id !== activeFilters.sectorId)            return false
      return true
    })
  }, [allTickets, activeFilters, viewMode])

  const hasFilters = !!(search || urgency || nature || sectorId)

  const STATUS_PILLS: { value: TicketStatus | ''; label: string }[] = [
    { value: '',            label: 'Todos'        },
    { value: 'open',        label: 'Abertos'      },
    { value: 'in_progress', label: 'Em andamento' },
    { value: 'waiting_part',label: 'Aguard. peça' },
    { value: 'concluded',   label: 'Concluídos'   },
  ]
  const [statusFilter, setStatusFilter] = useState<TicketStatus | ''>('')

  const finalTickets = useMemo(() => {
    if (!statusFilter || viewMode === 'kanban') return displayTickets
    return displayTickets.filter((t) => t.status === statusFilter)
  }, [displayTickets, statusFilter, viewMode])

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────── */}
      <PageHeader
        title="Chamados"
        description="Gerencie chamados de manutenção da unidade"
        actions={
          <Button onClick={() => setModalOpen(true)} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            Novo Chamado
          </Button>
        }
      />

      {/* ── KPI Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={ClipboardList} label="Abertos"        value={kpis.open}       colorClass="text-blue-500"   isLoading={isLoading} />
        <KpiCard icon={Wrench}        label="Em andamento"   value={kpis.inProgress} colorClass="text-amber-500"  isLoading={isLoading} />
        <KpiCard icon={AlertTriangle} label="Atrasados"      value={kpis.overdue}    colorClass="text-red-500"    isLoading={isLoading} />
        <KpiCard icon={CheckCircle2}  label="Concluídos/mês" value={kpis.concluded}  colorClass="text-green-500"  isLoading={isLoading} />
      </div>

      {/* ── Controls ────────────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        {/* Row 1: search + view toggle */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar chamados..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-border-focus placeholder:text-text-tertiary"
            />
          </div>
          <ViewToggle mode={viewMode} onChange={changeView} />
        </div>

        {/* Row 2: dropdown filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sector */}
          <Select value={sectorId || 'all'} onValueChange={(v) => setSectorId(v === 'all' ? '' : (v ?? ''))}>
            <SelectTrigger className="h-8 text-xs w-[140px]">
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              {sectors.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Urgency */}
          <Select value={urgency || 'all'} onValueChange={(v) => setUrgency(v === 'all' ? '' : (v ?? '') as TicketUrgency)}>
            <SelectTrigger className="h-8 text-xs w-[130px]">
              <SelectValue placeholder="Urgência" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda urgência</SelectItem>
              <SelectItem value="critical">Crítico</SelectItem>
              <SelectItem value="high">Alto</SelectItem>
              <SelectItem value="medium">Médio</SelectItem>
              <SelectItem value="low">Baixo</SelectItem>
            </SelectContent>
          </Select>

          {/* Nature */}
          <Select value={nature || 'all'} onValueChange={(v) => setNature(v === 'all' ? '' : (v ?? '') as TicketNature)}>
            <SelectTrigger className="h-8 text-xs w-[130px]">
              <SelectValue placeholder="Natureza" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda natureza</SelectItem>
              <SelectItem value="emergencial">Emergencial</SelectItem>
              <SelectItem value="pontual">Pontual</SelectItem>
              <SelectItem value="agendado">Agendado</SelectItem>
              <SelectItem value="preventivo">Preventivo</SelectItem>
            </SelectContent>
          </Select>

          {hasFilters && (
            <button
              type="button"
              onClick={() => { setSearch(''); setUrgency(''); setNature(''); setSectorId('') }}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* Row 3: status pills (list mode only) */}
        {viewMode === 'list' && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {STATUS_PILLS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={cn(
                  'shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
                  statusFilter === value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Content ─────────────────────────────────────────── */}
      {isLoading && isTimedOut ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <p className="text-text-secondary text-sm">O carregamento está demorando mais que o esperado.</p>
          <button onClick={retry} className="text-sm text-primary underline underline-offset-4">
            Tentar novamente
          </button>
        </div>
      ) : viewMode === 'kanban' ? (
        <TicketKanbanBoard
          filters={{
            search:   search   || undefined,
            urgency:  urgency  ? [urgency  as TicketUrgency] : undefined,
            nature:   nature   ? [nature   as TicketNature]  : undefined,
            sectorId: sectorId || undefined,
          }}
        />
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <TicketCardSkeleton key={i} />)}
        </div>
      ) : finalTickets.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={hasFilters || statusFilter ? 'Nenhum chamado encontrado' : 'Nenhum chamado ainda'}
          description={
            hasFilters || statusFilter
              ? 'Tente ajustar os filtros ou limpar a busca.'
              : 'Abra o primeiro chamado para registrar uma ocorrência de manutenção.'
          }
          action={
            !hasFilters && !statusFilter
              ? { label: 'Abrir chamado', onClick: () => setModalOpen(true) }
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {finalTickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onClick={() => router.push(`/manutencao/chamados/${ticket.id}`)}
            />
          ))}
        </div>
      )}

      {/* ── Modal ───────────────────────────────────────────── */}
      <TicketFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(id) => router.push(`/manutencao/chamados/${id}`)}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────
export default function ChamadosPage() {
  return (
    <Suspense fallback={
      <div className="space-y-5">
        <div className="h-10 w-48 skeleton-shimmer rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl border p-4 h-20 skeleton-shimmer" />
          ))}
        </div>
        <div className="bg-card rounded-xl border p-4 h-28 skeleton-shimmer" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <TicketCardSkeleton key={i} />)}
        </div>
      </div>
    }>
      <ChamadosContent />
    </Suspense>
  )
}
