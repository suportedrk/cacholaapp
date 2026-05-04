'use client'

import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { useMeetingMinutes } from '@/hooks/use-meeting-minutes'
import { useMeetingMinutesFiltersStore } from '@/stores/meeting-minutes-filters-store'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { useAuthReadyStore } from '@/stores/auth-store'
import { MeetingMinuteCard } from './components/MeetingMinuteCard'
import { MeetingMinuteCardSkeleton } from './components/MeetingMinuteCardSkeleton'
import { MeetingMinutesFiltersBar } from './components/MeetingMinutesFilters'
import { MeetingMinutesEmptyState } from './components/MeetingMinutesEmptyState'
import { ATAS_MANAGE_ROLES, hasRole } from '@/config/roles'

export default function AtasPage() {
  const router = useRouter()
  const profile = useAuthReadyStore((s) => s.profile)

  // ── Filters state ──────────────────────────────────────────
  const filters = useMeetingMinutesFiltersStore((s) => s.filters)
  const setFilter = useMeetingMinutesFiltersStore((s) => s.setFilter)
  const resetFilters = useMeetingMinutesFiltersStore((s) => s.resetFilters)
  const hasActiveFilters = useMeetingMinutesFiltersStore((s) => s.hasActiveFilters)()

  // ── Data ───────────────────────────────────────────────────
  const {
    data: minutes = [],
    isLoading,
    isError,
    refetch,
  } = useMeetingMinutes(filters)

  const { isTimedOut, retry } = useLoadingTimeout(isLoading)

  const showOnlyMine = hasRole(profile?.role, ATAS_MANAGE_ROLES)

  // ── Handlers ───────────────────────────────────────────────
  function handleCreate() {
    router.push('/atas/nova')
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Page header ───────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Atas de Reunião</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Registre e acompanhe as atas e itens de ação das reuniões
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-[0.98] transition-all"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">Nova Ata</span>
          <span className="sm:hidden">Nova</span>
        </button>
      </div>

      {/* ── Filters ───────────────────────────────────────── */}
      <MeetingMinutesFiltersBar
        filters={filters}
        onFilterChange={setFilter}
        onReset={resetFilters}
        hasActiveFilters={hasActiveFilters}
        totalCount={isLoading ? undefined : minutes.length}
        showOnlyMine={showOnlyMine}
      />

      {/* ── Content ───────────────────────────────────────── */}
      {isError ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <p className="text-sm text-muted-foreground">
            Erro ao carregar atas. Verifique sua conexão.
          </p>
          <button
            onClick={() => refetch()}
            className="text-sm text-primary hover:underline"
          >
            Tentar novamente
          </button>
        </div>
      ) : isLoading && isTimedOut ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <p className="text-text-secondary text-sm">
            O carregamento está demorando mais que o esperado.
          </p>
          <button
            onClick={retry}
            className="text-sm text-primary underline underline-offset-4"
          >
            Tentar novamente
          </button>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <MeetingMinuteCardSkeleton key={i} />
          ))}
        </div>
      ) : minutes.length === 0 ? (
        <MeetingMinutesEmptyState
          hasFilters={hasActiveFilters}
          onClearFilters={resetFilters}
          onCreateMinute={handleCreate}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {minutes.map((minute, i) => (
            <MeetingMinuteCard
              key={minute.id}
              minute={minute}
              animationDelay={Math.min(i * 40, 200)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
