'use client'

import { useMemo } from 'react'
import { Users, Trophy, ListChecks } from 'lucide-react'
import { useStaffReport } from '@/hooks/use-reports'
import { ReportStatsCard } from './report-stats-card'
import { HorizontalBarChartCard } from './horizontal-bar-chart-card'
import { ExportButton } from './export-button'
import type { ReportFilters } from '@/types/database.types'
import { CHART_COLORS } from '@/lib/constants/brand-colors'

type StaffTabProps = {
  filters:  ReportFilters
  unitName?: string
}

export function StaffTab({ filters, unitName }: StaffTabProps) {
  const { summary, byEvents, byChecklists } = useStaffReport(filters)

  // Eventos por pessoa — horizontal bar
  const eventsData = (byEvents.data ?? []).map((r) => ({
    name:  r.user_name,
    value: Number(r.events_count),
  }))

  // Checklists por pessoa — horizontal bar
  const checklistsData = (byChecklists.data ?? []).map((r) => ({
    name:  r.user_name,
    value: Number(r.checklists_completed),
  }))

  // Tabela completa de equipe
  const tableRows = useMemo(() => {
    return (byChecklists.data ?? []).map((r) => ({
      name:                 r.user_name,
      events:               String(
        byEvents.data?.find((e) => e.user_id === r.user_id)?.events_count ?? 0
      ),
      checklists_completed: String(r.checklists_completed),
      checklists_overdue:   String(r.checklists_overdue),
      maintenance:          String(r.maintenance_count),
    }))
  }, [byChecklists.data, byEvents.data])

  const tableColumns = [
    { key: 'name',                 header: 'Colaborador' },
    { key: 'events',               header: 'Eventos' },
    { key: 'checklists_completed', header: 'Checklists concluídos' },
    { key: 'checklists_overdue',   header: 'Checklists atrasados' },
    { key: 'maintenance',          header: 'Manutenções atribuídas' },
  ]

  const sumData = summary.data
  const avgEvt  = sumData?.avg_events_per_user != null
    ? `${sumData.avg_events_per_user} eventos/pessoa`
    : '—'

  return (
    <div id="report-content-equipe" className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <ReportStatsCard
          title="Colaborador com mais eventos"
          value={sumData?.top_events_user ?? '—'}
          icon={Trophy}
          loading={summary.isLoading}
        />
        <ReportStatsCard
          title="Mais checklists concluídos"
          value={sumData?.top_checklists_user ?? '—'}
          icon={ListChecks}
          loading={summary.isLoading}
          accent="success"
        />
        <ReportStatsCard
          title="Média de eventos"
          value={avgEvt}
          icon={Users}
          loading={summary.isLoading}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HorizontalBarChartCard
          title="Eventos por colaborador"
          data={eventsData}
          loading={byEvents.isLoading}
          color={CHART_COLORS.staffEvents}
        />
        <HorizontalBarChartCard
          title="Checklists concluídos por colaborador"
          data={checklistsData}
          loading={byChecklists.isLoading}
          color={CHART_COLORS.staffChecklists}
        />
      </div>

      {/* Tabela */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-sm font-semibold text-foreground">
            Resumo por colaborador ({tableRows.length})
          </h3>
          <ExportButton
            rows={tableRows}
            columns={tableColumns}
            elementId="report-content-equipe"
            tabName="equipe"
            filters={filters}
            unitName={unitName}
            disabled={byChecklists.isLoading || tableRows.length === 0}
          />
        </div>

        {byChecklists.isLoading ? (
          <div className="p-5 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : tableRows.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">
            Nenhum colaborador com atividades no período
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  {tableColumns.map((c) => (
                    <th key={c.key} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, i) => (
                  <tr key={i} className="border-t hover:bg-muted/30 transition-colors">
                    {tableColumns.map((c) => (
                      <td key={c.key} className="px-4 py-3 text-foreground whitespace-nowrap">
                        {String(row[c.key as keyof typeof row] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
