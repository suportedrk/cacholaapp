'use client'

import { useMemo } from 'react'
import { Wrench, CheckCircle2, Clock, MapPin } from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useMaintenanceReport } from '@/hooks/use-reports'
import { ReportStatsCard } from './report-stats-card'
import { BarChartCard } from './bar-chart-card'
import { HorizontalBarChartCard } from './horizontal-bar-chart-card'
import { ExportButton } from './export-button'
import type { ReportFilters } from '@/types/database.types'
import { CHART_COLORS } from '@/lib/constants/brand-colors'

const TYPE_LABEL: Record<string, string> = {
  emergency: 'Emergencial',
  punctual:  'Pontual',
  recurring: 'Recorrente',
}
const PRIORITY_LABEL: Record<string, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica',
}
const STATUS_LABEL: Record<string, string> = {
  open: 'Aberta', in_progress: 'Em Andamento',
  waiting_parts: 'Aguardando Peça', completed: 'Concluída', cancelled: 'Cancelada',
}

type MaintenanceTabProps = {
  filters:  ReportFilters
  unitName?: string
}

export function MaintenanceTab({ filters, unitName }: MaintenanceTabProps) {
  const { summary, byMonth, bySector, detail } = useMaintenanceReport(filters)

  // Dados mensais para gráfico agrupado
  const byMonthData = useMemo(() => {
    return (byMonth.data ?? []).map((r) => ({
      month: (() => {
        try { return format(parseISO(`${r.month}-01`), 'MMM/yy', { locale: ptBR }) }
        catch { return r.month }
      })(),
      'Abertas':    Number(r.open_count),
      'Concluídas': Number(r.completed_count),
    }))
  }, [byMonth.data])

  const byMonthSeries = [
    { dataKey: 'Abertas',    name: 'Abertas',    color: CHART_COLORS.maintenanceOpen },
    { dataKey: 'Concluídas', name: 'Concluídas', color: CHART_COLORS.maintenanceClosed },
  ]

  // Setor para gráfico horizontal
  const sectorData = (bySector.data ?? []).map((r) => ({
    name:  r.sector_name,
    value: Number(r.count),
  }))

  // Detalhes da tabela
  const detailRows = useMemo(() => {
    return (detail.data ?? []).map((m) => {
      const mo = m as unknown as {
        id: string; title: string; type: string; priority: string; status: string
        created_at: string; updated_at: string;
        sector: { name: string } | null;
        assigned_user: { name: string } | null;
      }
      const daysToResolve = mo.status === 'completed'
        ? differenceInDays(parseISO(mo.updated_at), parseISO(mo.created_at))
        : null
      return {
        date:        format(parseISO(mo.created_at), 'dd/MM/yyyy'),
        title:       mo.title,
        type:        TYPE_LABEL[mo.type] ?? mo.type,
        priority:    PRIORITY_LABEL[mo.priority] ?? mo.priority,
        sector:      mo.sector?.name ?? '—',
        responsible: mo.assigned_user?.name ?? '—',
        status:      STATUS_LABEL[mo.status] ?? mo.status,
        days:        daysToResolve != null ? `${daysToResolve}d` : '—',
      }
    })
  }, [detail.data])

  const detailColumns = [
    { key: 'date',        header: 'Data Abertura' },
    { key: 'title',       header: 'Título' },
    { key: 'type',        header: 'Tipo' },
    { key: 'priority',    header: 'Prioridade' },
    { key: 'sector',      header: 'Setor' },
    { key: 'responsible', header: 'Responsável' },
    { key: 'status',      header: 'Status' },
    { key: 'days',        header: 'Dias p/ resolver' },
  ]

  const sumData = summary.data
  const avgDays = sumData?.avg_resolution_days != null
    ? `${sumData.avg_resolution_days} dias`
    : '—'

  return (
    <div id="report-content-manutencoes" className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportStatsCard
          title="Total abertas"
          value={sumData?.total_open ?? 0}
          icon={Wrench}
          loading={summary.isLoading}
          accent="warning"
        />
        <ReportStatsCard
          title="Total concluídas"
          value={sumData?.total_completed ?? 0}
          icon={CheckCircle2}
          loading={summary.isLoading}
          accent="success"
        />
        <ReportStatsCard
          title="Tempo médio de resolução"
          value={avgDays}
          icon={Clock}
          loading={summary.isLoading}
        />
        <ReportStatsCard
          title="Setor com mais ordens"
          value={sumData?.top_sector ?? '—'}
          icon={MapPin}
          loading={summary.isLoading}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BarChartCard
          title="Abertas vs Concluídas por mês"
          data={byMonthData}
          series={byMonthSeries}
          xKey="month"
          loading={byMonth.isLoading}
          className="lg:col-span-2"
        />
        <HorizontalBarChartCard
          title="Por setor"
          data={sectorData}
          loading={bySector.isLoading}
          color={CHART_COLORS.neutral}
        />
      </div>

      {/* Tabela */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-sm font-semibold text-foreground">
            Detalhamento ({detailRows.length} ordens)
          </h3>
          <ExportButton
            rows={detailRows}
            columns={detailColumns}
            elementId="report-content-manutencoes"
            tabName="manutencoes"
            filters={filters}
            unitName={unitName}
            disabled={detail.isLoading || detailRows.length === 0}
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
            Nenhuma manutenção no período selecionado
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
