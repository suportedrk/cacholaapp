'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { startOfMonth, endOfMonth, addMonths, subMonths, format } from 'date-fns'
import { ChevronLeft, ChevronRight, CalendarDays, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { useMaintenanceSchedule } from '@/hooks/use-maintenance-schedule'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import {
  MaintenanceAgendaCalendar,
  formatMonthLabel,
} from '@/components/features/maintenance/maintenance-agenda-calendar'
import { ROUTES } from '@/lib/constants'

export default function ManutencaoAgendaPage() {
  const router = useRouter()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))

  const dateFrom = useMemo(() => format(startOfMonth(month), 'yyyy-MM-dd'), [month])
  const dateTo   = useMemo(() => format(endOfMonth(month), 'yyyy-MM-dd'), [month])

  const { data: executions = [], isLoading, isError, refetch } = useMaintenanceSchedule(dateFrom, dateTo)
  const { isTimedOut, retry } = useLoadingTimeout(isLoading)

  const showError = isError || isTimedOut

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agenda de Manutenção"
        description="Execuções agendadas por data. Clique em um item para abrir o chamado."
      />

      {/* Navegação de mês */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">
          {formatMonthLabel(month)}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setMonth((m) => subMonths(m, 1))} aria-label="Mês anterior">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
            Hoje
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Próximo mês">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {showError ? (
        <div className="rounded-xl border border-status-error-border bg-status-error-bg p-6 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 mx-auto text-status-error-text" />
          <p className="text-sm text-status-error-text">Não foi possível carregar a agenda.</p>
          <Button variant="outline" size="sm" onClick={() => { retry(); refetch() }}>
            Tentar novamente
          </Button>
        </div>
      ) : isLoading ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <div className="skeleton-shimmer h-64 rounded-lg" />
        </div>
      ) : executions.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center space-y-3">
          <CalendarDays className="w-10 h-10 mx-auto text-text-tertiary" />
          <p className="text-sm text-text-secondary">Nenhuma execução agendada neste mês.</p>
          <p className="text-xs text-text-tertiary">
            Agende uma execução no detalhe de um chamado para vê-la aqui.
          </p>
        </div>
      ) : (
        <MaintenanceAgendaCalendar
          month={month}
          executions={executions}
          onSelect={(ticketId) => router.push(`${ROUTES.maintenanceChamados}/${ticketId}`)}
        />
      )}
    </div>
  )
}
