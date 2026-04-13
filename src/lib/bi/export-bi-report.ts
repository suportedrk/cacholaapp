/**
 * BI Report — Excel export (client-side via SheetJS dynamic import)
 * 4 sheets: Resumo, Desempenho Mensal, Funil do Pipeline, Comparativo Unidades
 */

import type { BIConversionData } from '@/hooks/use-bi-conversion'
import type { BISalesMetricsData } from '@/hooks/use-bi-sales-metrics'
import type { BIFunnelData } from '@/hooks/use-bi-funnel'
import type { UnitComparisonRow } from '@/hooks/use-bi-unit-comparison'

// ── Types ─────────────────────────────────────────────────────

export interface ExportBIReportParams {
  conversion:     BIConversionData
  sales:          BISalesMetricsData
  funnel:         BIFunnelData
  unitComparison: UnitComparisonRow[]
  unitName:       string   // "Pinheiros" | "Todas as unidades"
  exportDate:     Date
}

// ── Helpers ───────────────────────────────────────────────────

function formatDateBR(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatFilenameDate(date: Date): string {
  return date.toISOString().slice(0, 10) // 2026-04-13
}

function formatMonthLabel(yyyyMM: string): string {
  const [year, month] = yyyyMM.split('-')
  const d = new Date(Number(year), Number(month) - 1, 1)
  return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
}

function autoFit(data: (string | number | null | undefined)[][]): { wch: number }[] {
  if (data.length === 0) return []
  const colCount = data[0].length
  return Array.from({ length: colCount }, (_, ci) => {
    const maxLen = data.reduce((max, row) => {
      const len = String(row[ci] ?? '').length
      return Math.max(max, len)
    }, 0)
    return { wch: Math.min(Math.max(maxLen + 2, 10), 36) }
  })
}

// ── Main export function ──────────────────────────────────────

export async function exportBIReport(params: ExportBIReportParams): Promise<void> {
  const XLSX = await import('xlsx')

  const { conversion, sales, funnel, unitComparison, unitName, exportDate } = params
  const wb = XLSX.utils.book_new()

  // ── ABA 1 — Resumo ──────────────────────────────────────────
  {
    const current  = sales.currentMonth
    const previous = sales.previousMonth

    function trendLabel(curr: number | null, prev: number | null, suffix = '%'): string {
      if (curr == null || prev == null || prev === 0) return ''
      const pct = Math.round(((curr - prev) / prev) * 100)
      return pct >= 0 ? `+${pct}${suffix}` : `${pct}${suffix}`
    }

    const convTrend = conversion.trend != null
      ? (conversion.trend >= 0 ? `+${conversion.trend}pp` : `${conversion.trend}pp`)
      : ''

    const rows: (string | number | null)[][] = [
      ['Cachola OS — Business Intelligence'],
      [`Exportado em: ${formatDateBR(exportDate)}`],
      [`Unidade: ${unitName}`],
      [],
      ['INDICADOR', 'VALOR (mês atual)', 'VARIAÇÃO'],
      [
        'Taxa de Conversão',
        conversion.currentRate != null ? conversion.currentRate / 100 : null,
        convTrend,
      ],
      [
        'Tempo Médio de Fechamento (dias)',
        current?.avg_closing_days != null ? Math.round(current.avg_closing_days) : null,
        trendLabel(current?.avg_closing_days ?? null, previous?.avg_closing_days ?? null),
      ],
      [
        'Ticket Médio (R$)',
        current?.avg_ticket ?? null,
        trendLabel(current?.avg_ticket ?? null, previous?.avg_ticket ?? null),
      ],
      [
        'Receita do Mês (R$)',
        current?.total_revenue ?? null,
        trendLabel(current?.total_revenue ?? null, previous?.total_revenue ?? null),
      ],
      [
        'Antecedência Média de Reserva (dias)',
        current?.avg_booking_advance_days != null
          ? Math.round(current.avg_booking_advance_days)
          : null,
        '',
      ],
      [],
      [`Período analisado: últimos 7 meses`],
    ]

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 38 }, { wch: 22 }, { wch: 14 }]

    // Format Taxa de Conversão cell as percentage
    const convCell = ws['B6']
    if (convCell && convCell.v != null) {
      convCell.z = '0.00%'
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Resumo')
  }

  // ── ABA 2 — Desempenho Mensal ───────────────────────────────
  {
    const convMap = new Map(conversion.rows.map((r) => [r.month, r]))
    const salesMap = new Map(sales.rows.map((r) => [r.month, r]))

    const allMonths = Array.from(new Set([
      ...convMap.keys(),
      ...salesMap.keys(),
    ])).sort((a, b) => b.localeCompare(a))  // newest first

    const header = [
      'Mês',
      'Leads',
      'Ganhos',
      'Conversão',
      'Receita (R$)',
      'Ticket Médio (R$)',
      'Fechamento (dias)',
      'Antecedência (dias)',
    ]

    const dataRows = allMonths.map((month) => {
      const c = convMap.get(month)
      const s = salesMap.get(month)
      return [
        formatMonthLabel(month),
        c?.total_leads  ?? 0,
        c?.won_leads    ?? 0,
        c?.conversion_rate != null ? c.conversion_rate / 100 : null,
        s?.total_revenue      ?? 0,
        s?.avg_ticket         ?? null,
        s?.avg_closing_days   != null ? Math.round(s.avg_closing_days)          : null,
        s?.avg_booking_advance_days != null ? Math.round(s.avg_booking_advance_days) : null,
      ]
    })

    const allRows = [header, ...dataRows]
    const ws = XLSX.utils.aoa_to_sheet(allRows)
    ws['!cols'] = autoFit(allRows)

    // Format "Conversão" column (D) as percentage for data rows
    dataRows.forEach((_, i) => {
      const cellRef = XLSX.utils.encode_cell({ r: i + 1, c: 3 })
      const cell = ws[cellRef]
      if (cell && cell.v != null) cell.z = '0.00%'
    })

    XLSX.utils.book_append_sheet(wb, ws, 'Desempenho Mensal')
  }

  // ── ABA 3 — Funil do Pipeline ───────────────────────────────
  {
    const header = ['Stage', 'Total', 'Em Aberto', 'Ganhos', 'Perdidos']

    const dataRows = funnel.stages.map((s) => [
      s.stage_name,
      s.total,
      s.em_aberto,
      s.ganhos,
      s.perdidos,
    ])

    // Summary footer
    const totals = funnel.stages.reduce(
      (acc, s) => ({
        total:     acc.total     + s.total,
        em_aberto: acc.em_aberto + s.em_aberto,
        ganhos:    acc.ganhos    + s.ganhos,
        perdidos:  acc.perdidos  + s.perdidos,
      }),
      { total: 0, em_aberto: 0, ganhos: 0, perdidos: 0 },
    )

    const allRows = [
      header,
      ...dataRows,
      [],
      ['TOTAL', totals.total, totals.em_aberto, totals.ganhos, totals.perdidos],
    ]

    const ws = XLSX.utils.aoa_to_sheet(allRows)
    ws['!cols'] = autoFit(allRows)

    XLSX.utils.book_append_sheet(wb, ws, 'Funil do Pipeline')
  }

  // ── ABA 4 — Comparativo Unidades ───────────────────────────
  {
    if (unitComparison.length > 0) {
      // Transposed: metrics as rows, units as columns
      const unitNames = unitComparison.map((r) => r.unit_name)
      const header = ['Métrica', ...unitNames]

      const metricRows: (string | number | null)[][] = [
        ['Total de Leads',          ...unitComparison.map((r) => r.total_leads)],
        ['Leads Ganhos',            ...unitComparison.map((r) => r.won_leads)],
        ['Conversão',               ...unitComparison.map((r) =>
          r.conversion_rate != null ? r.conversion_rate / 100 : null)],
        ['Receita Total (R$)',      ...unitComparison.map((r) => r.total_revenue)],
        ['Ticket Médio (R$)',       ...unitComparison.map((r) => r.avg_ticket)],
        ['Tempo Fechamento (dias)', ...unitComparison.map((r) =>
          r.avg_closing_days != null ? Math.round(r.avg_closing_days) : null)],
        ['Antecedência (dias)',     ...unitComparison.map((r) =>
          r.avg_booking_advance != null ? Math.round(r.avg_booking_advance) : null)],
      ]

      const allRows = [header, ...metricRows]
      const ws = XLSX.utils.aoa_to_sheet(allRows)
      ws['!cols'] = autoFit(allRows)

      // Format Conversão row (index 3, row 4) as percentage
      const convRowIdx = 3  // 0=header, 1=Total Leads, 2=Won, 3=Conversão
      unitComparison.forEach((_, ci) => {
        const cellRef = XLSX.utils.encode_cell({ r: convRowIdx, c: ci + 1 })
        const cell = ws[cellRef]
        if (cell && cell.v != null) cell.z = '0.00%'
      })

      XLSX.utils.book_append_sheet(wb, ws, 'Comparativo Unidades')
    }
  }

  // ── Generate file ────────────────────────────────────────────
  const unitSlug = unitName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')

  const filename = `BI_Cachola_${unitSlug}_${formatFilenameDate(exportDate)}.xlsx`
  XLSX.writeFile(wb, filename)
}
