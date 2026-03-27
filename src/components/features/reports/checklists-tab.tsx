'use client'

import { useMemo } from 'react'
import { ListChecks, CheckCircle2, AlertCircle, Tag } from 'lucide-react'
import { format, parseISO, isPast } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useChecklistReport } from '@/hooks/use-reports'
import { ReportStatsCard } from './report-stats-card'
import { BarChartCard } from './bar-chart-card'
import { DonutChartCard, CHART_COLORS } from './donut-chart-card'
import { ExportButton } from './export-button'
import type { ReportFilters } from '@/types/database.types'

const STATUS_LABEL: Record<string, string> = {
  pending:     'Pendente',
  in_progress: 'Em Andamento',
  completed:   'Concluído',
  cancelled:   'Cancelado',
}

type ChecklistsTabProps = {
  filters:  ReportFilters
  unitName?: string
}

export function ChecklistsTab({ filters, unitName }: ChecklistsTabProps) {
  const { summary, byMonth, byCategory, detail } = useChecklistReport(filters)

  // Dados mensais
  const byMonthData = useMemo(() => {
    return (byMonth.data ?? []).map((r) => ({
      month: (() => {
        try { return format(parseISO(`${r.month}-01`), 'MMM/yy', { locale: ptBR }) }
        catch { return r.month }
      })(),
      'Concluídos': Number(r.completed_count),
      'Atrasados':  Number(r.overdue_count),
    }))
  }, [byMonth.data])

  const byMonthSeries = [
    { dataKey: 'Concluídos', name: 'Concluídos', color: '#7C8D78' },
    { dataKey: 'Atrasados',  name: 'Atrasados',  color: '#E07070' },
  ]

  // Donut por categoria
  const categoryData = (byCategory.data ?? []).map((r, i) => ({
    name:  r.category_name,
    value: Number(r.total_count),
  }))

  // Detalhes
  const detailRows = useMemo(() => {
    return (detail.data ?? []).map((c) => {
      const cl = c as unknown as {
        id: string; title: string; status: string; due_date: string | null; created_at: string;
        event:         { title: string } | null;
        assigned_user: { name: string } | null;
        template:      { category: { name: string } | null } | null;
        checklist_items: { id: string; status: string }[];
      }
      const items       = cl.checklist_items ?? []
      const done        = items.filter((i) => i.status === 'done').length
      const pctDone     = items.length > 0 ? Math.round((done / items.length) * 100) : 0
      const isOverdue   = cl.status !== 'completed' && cl.status !== 'cancelled'
        && cl.due_date != null && isPast(parseISO(cl.due_date))

      return {
        event:     cl.event?.title ?? '—',
        checklist: cl.title,
        category:  cl.template?.category?.name ?? '—',
        assigned:  cl.assigned_user?.name ?? '—',
        due:       cl.due_date ? format(parseISO(cl.due_date), 'dd/MM/yyyy') : '—',
        status:    STATUS_LABEL[cl.status] ?? cl.status,
        pct:       `${pctDone}%`,
        overdue:   isOverdue ? 'Sim' : 'Não',
      }
    })
  }, [detail.data])

  const detailColumns = [
    { key: 'event',     header: 'Evento' },
    { key: 'checklist', header: 'Checklist' },
    { key: 'category',  header: 'Categoria' },
    { key: 'assigned',  header: 'Responsável' },
    { key: 'due',       header: 'Prazo' },
    { key: 'status',    header: 'Status' },
    { key: 'pct',       header: '% Concluído' },
  ]

  const sumData = summary.data
  const onTimePct = sumData && sumData.total > 0
    ? `${Math.round((sumData.on_time_count / sumData.total) * 100)}%`
    : '—'
  const overduePct = sumData && sumData.total > 0
    ? `${Math.round((sumData.overdue_count / sumData.total) * 100)}%`
    : '—'

  return (
    <div id="report-content-checklists" className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportStatsCard
          title="Total de checklists"
          value={sumData?.total ?? 0}
          icon={ListChecks}
          loading={summary.isLoading}
        />
        <ReportStatsCard
          title="Concluídos no prazo"
          value={onTimePct}
          icon={CheckCircle2}
          loading={summary.isLoading}
          accent="success"
        />
        <ReportStatsCard
          title="Atrasados"
          value={overduePct}
          icon={AlertCircle}
          loading={summary.isLoading}
          accent="danger"
        />
        <ReportStatsCard
          title="Categoria com mais atrasos"
          value={sumData?.top_overdue_cat ?? '—'}
          icon={Tag}
          loading={summary.isLoading}
          accent="warning"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BarChartCard
          title="Concluídos vs Atrasados por mês"
          data={byMonthData}
          series={byMonthSeries}
          xKey="month"
          loading={byMonth.isLoading}
          className="lg:col-span-2"
        />
        <DonutChartCard
          title="Por categoria"
          data={categoryData}
          loading={byCategory.isLoading}
        />
      </div>

      {/* Tabela */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-sm font-semibold text-foreground">
            Detalhamento ({detailRows.length} checklists)
          </h3>
          <ExportButton
            rows={detailRows}
            columns={detailColumns}
            elementId="report-content-checklists"
            tabName="checklists"
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
            Nenhum checklist no período selecionado
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
