/**
 * BI Vendedoras — Excel export (client-side via SheetJS dynamic import)
 * 2 sheets: Ranking | Histórico Mensal (uma linha por vendedora × mês)
 */

import type { SellerRankingRow } from '@/hooks/use-bi-sellers-ranking'
import type { SellerHistoryPoint } from '@/hooks/use-bi-seller-history'

// ── Types ─────────────────────────────────────────────────────

export interface ExportSellersReportParams {
  ranking: SellerRankingRow[]
  /** Map: ownerName → array de pontos mensais */
  historyMap: Map<string, SellerHistoryPoint[]>
  unitName: string
  periodMonths: number
  exportDate: Date
}

// ── Helpers ───────────────────────────────────────────────────

function formatFilenameDate(date: Date): string {
  return date.toISOString().slice(0, 10)
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

export async function exportSellersReport(params: ExportSellersReportParams): Promise<void> {
  const XLSX = await import('xlsx')

  const { ranking, historyMap, unitName, periodMonths, exportDate } = params
  const wb = XLSX.utils.book_new()

  // ── ABA 1 — Ranking ─────────────────────────────────────────
  {
    const headers = [
      'Pos', 'Vendedora', 'Leads', 'Ganhos', 'Perdidos',
      'Em Aberto', 'Conv%', 'Ticket Médio (R$)', 'Receita (R$)',
    ]
    const rows: (string | number | null)[][] = ranking.map((r, i) => [
      i + 1,
      r.owner_name,
      r.leads_count,
      r.won_count,
      r.lost_count,
      r.open_count,
      r.conversion_rate / 100,
      r.avg_ticket,
      r.total_revenue,
    ])

    const allRows = [headers, ...rows]
    const ws = XLSX.utils.aoa_to_sheet(allRows)

    // Format conversion as %
    for (let i = 1; i <= rows.length; i++) {
      const cellRef = XLSX.utils.encode_cell({ r: i, c: 6 })
      if (ws[cellRef]) ws[cellRef].z = '0.0%'
    }

    ws['!cols'] = autoFit(allRows)
    XLSX.utils.book_append_sheet(wb, ws, 'Ranking Vendedoras')
  }

  // ── ABA 2 — Histórico Mensal ─────────────────────────────────
  {
    const headers = [
      'Vendedora', 'Mês', 'Leads', 'Ganhos', 'Receita (R$)', 'Tempo Médio Fech. (dias)',
    ]
    const rows: (string | number | null)[][] = []

    for (const seller of ranking) {
      const history = historyMap.get(seller.owner_name) ?? []
      for (const pt of history) {
        rows.push([
          seller.owner_name,
          formatMonthLabel(pt.month_label),
          pt.leads_count,
          pt.won_count,
          pt.revenue,
          pt.avg_days_to_close,
        ])
      }
    }

    const allRows = [headers, ...rows]
    const ws = XLSX.utils.aoa_to_sheet(allRows)
    ws['!cols'] = autoFit(allRows)
    XLSX.utils.book_append_sheet(wb, ws, 'Histórico Mensal')
  }

  const unitSlug  = unitName.replace(/\s+/g, '_')
  const dateLabel = formatFilenameDate(exportDate)
  const filename  = `Vendedoras_${unitSlug}_${periodMonths}M_${dateLabel}.xlsx`

  XLSX.writeFile(wb, filename)
}
