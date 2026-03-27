'use client'

import { useMemo } from 'react'
import { Calendar, Users, Star, MapPin } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useEventReport } from '@/hooks/use-reports'
import { ReportStatsCard } from './report-stats-card'
import { BarChartCard } from './bar-chart-card'
import { DonutChartCard, CHART_COLORS } from './donut-chart-card'
import { HorizontalBarChartCard } from './horizontal-bar-chart-card'
import { ExportButton } from './export-button'
import type { ReportFilters } from '@/types/database.types'

// Status → label PT-BR
const STATUS_LABEL: Record<string, string> = {
  pending:     'Pendente',
  confirmed:   'Confirmado',
  preparing:   'Em Preparo',
  in_progress: 'Em Andamento',
  finished:    'Finalizado',
  cancelled:   'Cancelado',
}

// Cores por status
const STATUS_COLOR: Record<string, string> = {
  pending:     '#E3DAD1',
  confirmed:   '#7C8D78',
  preparing:   '#6B9E8B',
  in_progress: '#4A5E46',
  finished:    '#B5C4B1',
  cancelled:   '#9C8B78',
}

type EventsTabProps = {
  filters:  ReportFilters
  unitName?: string
}

export function EventsTab({ filters, unitName }: EventsTabProps) {
  const { summary, byMonth, byType, byVenue, detail } = useEventReport(filters)

  // Transformar byMonth em dados para gráfico de barras empilhadas
  const byMonthData = useMemo(() => {
    if (!byMonth.data) return []
    const map: Record<string, Record<string, number>> = {}
    for (const row of byMonth.data) {
      if (!map[row.month]) map[row.month] = { month: Number(row.month) }
      map[row.month][row.status] = (map[row.month][row.status] ?? 0) + Number(row.count)
    }
    return Object.values(map)
      .sort((a, b) => String(a.month) < String(b.month) ? -1 : 1)
      .map((r) => ({
        ...r,
        month: (() => {
          try { return format(parseISO(`${r.month}-01`), 'MMM/yy', { locale: ptBR }) }
          catch { return String(r.month) }
        })(),
      }))
  }, [byMonth.data])

  // Status únicos para séries do gráfico
  const statuses = useMemo(() => {
    if (!byMonth.data) return []
    return [...new Set(byMonth.data.map((r) => r.status))]
  }, [byMonth.data])

  const byMonthSeries = statuses.map((s) => ({
    dataKey: s,
    name:    STATUS_LABEL[s] ?? s,
    color:   STATUS_COLOR[s] ?? CHART_COLORS[0],
  }))

  // Donut por tipo
  const typeData = (byType.data ?? []).map((r) => ({
    name:  r.type_name,
    value: Number(r.count),
  }))

  // Horizontal bar por salão
  const venueData = (byVenue.data ?? []).map((r) => ({
    name:  r.venue_name,
    value: Number(r.count),
  }))

  // Tabela de detalhes
  const detailRows = useMemo(() => {
    return (detail.data ?? []).map((e) => {
      const ev = e as unknown as {
        id: string; title: string; date: string; guest_count: number | null; status: string;
        event_type: { name: string } | null;
        package:    { name: string } | null;
        venue:      { name: string } | null;
      }
      return {
        date:       format(parseISO(ev.date), 'dd/MM/yyyy'),
        title:      ev.title,
        type:       ev.event_type?.name ?? '—',
        package:    ev.package?.name ?? '—',
        venue:      ev.venue?.name ?? '—',
        guests:     ev.guest_count ?? 0,
        status:     STATUS_LABEL[ev.status] ?? ev.status,
      }
    })
  }, [detail.data])

  const detailColumns = [
    { key: 'date',    header: 'Data' },
    { key: 'title',   header: 'Evento' },
    { key: 'type',    header: 'Tipo' },
    { key: 'package', header: 'Pacote' },
    { key: 'venue',   header: 'Salão' },
    { key: 'guests',  header: 'Convidados' },
    { key: 'status',  header: 'Status' },
  ]

  const isLoading = summary.isLoading || byMonth.isLoading

  return (
    <div id="report-content-eventos" className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportStatsCard
          title="Total de eventos"
          value={summary.data?.total_events ?? 0}
          icon={Calendar}
          loading={summary.isLoading}
        />
        <ReportStatsCard
          title="Média de convidados"
          value={summary.data?.avg_guests != null ? `${summary.data.avg_guests}` : '—'}
          icon={Users}
          loading={summary.isLoading}
        />
        <ReportStatsCard
          title="Tipo mais comum"
          value={summary.data?.top_event_type ?? '—'}
          icon={Star}
          loading={summary.isLoading}
        />
        <ReportStatsCard
          title="Salão mais utilizado"
          value={summary.data?.top_venue ?? '—'}
          icon={MapPin}
          loading={summary.isLoading}
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BarChartCard
          title="Eventos por mês"
          data={byMonthData}
          series={byMonthSeries}
          xKey="month"
          loading={byMonth.isLoading}
          stacked
          className="lg:col-span-2"
        />
        <DonutChartCard
          title="Por tipo de evento"
          data={typeData}
          loading={byType.isLoading}
        />
      </div>

      {/* Charts row 2 */}
      <HorizontalBarChartCard
        title="Eventos por salão"
        data={venueData}
        loading={byVenue.isLoading}
        className="max-w-lg"
      />

      {/* Tabela */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-sm font-semibold text-foreground">
            Detalhamento ({detailRows.length} eventos)
          </h3>
          <ExportButton
            rows={detailRows}
            columns={detailColumns}
            elementId="report-content-eventos"
            tabName="eventos"
            filters={filters}
            unitName={unitName}
            disabled={isLoading || detailRows.length === 0}
          />
        </div>

        {detail.isLoading ? (
          <div className="p-5 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : detailRows.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">
            Nenhum evento no período selecionado
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  {detailColumns.map((c) => (
                    <th key={c.key} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detailRows.map((row, i) => (
                  <tr key={i} className="border-t hover:bg-muted/30 transition-colors">
                    {detailColumns.map((c) => (
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
