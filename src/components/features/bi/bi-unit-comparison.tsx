'use client'

import { cn } from '@/lib/utils'
import type { UnitComparisonRow } from '@/hooks/use-bi-unit-comparison'

// ── Types ─────────────────────────────────────────────────────

type Props = {
  rows: UnitComparisonRow[]
  months: number
}

// ── Helpers ───────────────────────────────────────────────────

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—'
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000)     return `R$ ${(value / 1_000).toFixed(1)}k`
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
  }).format(value)
}

function formatDays(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${Math.round(value)}d`
}

// Find the index of the best value in a column
// direction: 'higher' = bigger is better, 'lower' = smaller is better
function bestIndex(values: (number | null)[], direction: 'higher' | 'lower'): number | null {
  const valid = values
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: number; i: number } => x.v != null)

  if (valid.length < 2) return null

  const best = direction === 'higher'
    ? valid.reduce((a, b) => (a.v >= b.v ? a : b))
    : valid.reduce((a, b) => (a.v <= b.v ? a : b))

  return best.i
}

// ── Badge ─────────────────────────────────────────────────────

function BestBadge() {
  return (
    <span className="ml-1.5 inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800 shrink-0">
      ↑ melhor
    </span>
  )
}

// ── Component ─────────────────────────────────────────────────

export function BIUnitComparison({ rows, months }: Props) {
  if (rows.length === 0) return null

  // Pre-compute best indices for each metric
  const bestConversion  = bestIndex(rows.map((r) => r.conversion_rate),   'higher')
  const bestRevenue     = bestIndex(rows.map((r) => r.total_revenue),     'higher')
  const bestTicket      = bestIndex(rows.map((r) => r.avg_ticket),        'higher')
  const bestClosing     = bestIndex(rows.map((r) => r.avg_closing_days),  'lower')
  // avg_booking_advance: no best highlight (longer ≠ better inherently)

  // ── Desktop Table ────────────────────────────────────────────
  const desktopTable = (
    <div className="hidden sm:block overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-default bg-surface-secondary">
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wide whitespace-nowrap">
              Unidade
            </th>
            <th className="text-right px-3 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wide whitespace-nowrap">
              Leads
            </th>
            <th className="text-right px-3 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wide whitespace-nowrap">
              Ganhos
            </th>
            <th className="text-right px-3 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wide whitespace-nowrap">
              Conversão
            </th>
            <th className="text-right px-3 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wide whitespace-nowrap">
              Receita
            </th>
            <th className="text-right px-3 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wide whitespace-nowrap">
              Ticket Médio
            </th>
            <th className="text-right px-3 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wide whitespace-nowrap">
              Fechamento
            </th>
            <th className="text-right px-4 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wide whitespace-nowrap">
              Antecedência
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.unit_id}
              className="border-b border-border-default last:border-0 hover:bg-surface-secondary transition-colors"
            >
              {/* Unidade */}
              <td className="px-4 py-3 font-medium text-text-primary whitespace-nowrap">
                {row.unit_name}
              </td>

              {/* Leads */}
              <td className="px-3 py-3 text-right text-text-secondary tabular-nums">
                {row.total_leads.toLocaleString('pt-BR')}
              </td>

              {/* Ganhos */}
              <td className="px-3 py-3 text-right text-text-secondary tabular-nums">
                {row.won_leads.toLocaleString('pt-BR')}
              </td>

              {/* Conversão */}
              <td className="px-3 py-3 text-right tabular-nums">
                <span className="inline-flex items-center justify-end">
                  <span className={cn(
                    'font-semibold',
                    row.conversion_rate != null && row.conversion_rate >= 10
                      ? 'text-green-600 dark:text-green-400'
                      : row.conversion_rate != null && row.conversion_rate >= 5
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-red-600 dark:text-red-400',
                  )}>
                    {row.conversion_rate != null ? `${row.conversion_rate.toFixed(1)}%` : '—'}
                  </span>
                  {bestConversion === i && <BestBadge />}
                </span>
              </td>

              {/* Receita */}
              <td className="px-3 py-3 text-right text-text-secondary tabular-nums whitespace-nowrap">
                <span className="inline-flex items-center justify-end">
                  {formatCurrency(row.total_revenue)}
                  {bestRevenue === i && <BestBadge />}
                </span>
              </td>

              {/* Ticket Médio */}
              <td className="px-3 py-3 text-right text-text-secondary tabular-nums whitespace-nowrap">
                <span className="inline-flex items-center justify-end">
                  {formatCurrency(row.avg_ticket)}
                  {bestTicket === i && <BestBadge />}
                </span>
              </td>

              {/* Fechamento */}
              <td className="px-3 py-3 text-right text-text-secondary tabular-nums">
                <span className="inline-flex items-center justify-end">
                  {formatDays(row.avg_closing_days)}
                  {bestClosing === i && <BestBadge />}
                </span>
              </td>

              {/* Antecedência */}
              <td className="px-4 py-3 text-right text-text-secondary tabular-nums">
                {formatDays(row.avg_booking_advance)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  // ── Mobile Cards ─────────────────────────────────────────────
  const mobileCards = (
    <div className="sm:hidden space-y-3 px-4 py-3">
      {rows.map((row, i) => (
        <div
          key={row.unit_id}
          className="rounded-lg border border-border-default bg-surface-secondary p-3 space-y-2"
        >
          <p className="text-sm font-semibold text-text-primary">{row.unit_name}</p>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <div>
              <span className="text-text-tertiary">Leads</span>
              <p className="font-medium text-text-primary tabular-nums">
                {row.total_leads.toLocaleString('pt-BR')}
              </p>
            </div>
            <div>
              <span className="text-text-tertiary">Ganhos</span>
              <p className="font-medium text-text-primary tabular-nums">
                {row.won_leads.toLocaleString('pt-BR')}
              </p>
            </div>
            <div>
              <span className="text-text-tertiary">Conversão</span>
              <p className={cn(
                'font-semibold tabular-nums',
                row.conversion_rate != null && row.conversion_rate >= 10
                  ? 'text-green-600 dark:text-green-400'
                  : row.conversion_rate != null && row.conversion_rate >= 5
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-600 dark:text-red-400',
              )}>
                {row.conversion_rate != null ? `${row.conversion_rate.toFixed(1)}%` : '—'}
                {bestConversion === i && (
                  <span className="ml-1 text-[10px] font-semibold text-green-600 dark:text-green-400">↑</span>
                )}
              </p>
            </div>
            <div>
              <span className="text-text-tertiary">Receita</span>
              <p className="font-medium text-text-primary tabular-nums">
                {formatCurrency(row.total_revenue)}
                {bestRevenue === i && (
                  <span className="ml-1 text-[10px] font-semibold text-green-600 dark:text-green-400">↑</span>
                )}
              </p>
            </div>
            <div>
              <span className="text-text-tertiary">Ticket Médio</span>
              <p className="font-medium text-text-primary tabular-nums">
                {formatCurrency(row.avg_ticket)}
                {bestTicket === i && (
                  <span className="ml-1 text-[10px] font-semibold text-green-600 dark:text-green-400">↑</span>
                )}
              </p>
            </div>
            <div>
              <span className="text-text-tertiary">Fechamento</span>
              <p className="font-medium text-text-primary tabular-nums">
                {formatDays(row.avg_closing_days)}
                {bestClosing === i && (
                  <span className="ml-1 text-[10px] font-semibold text-green-600 dark:text-green-400">↓ melhor</span>
                )}
              </p>
            </div>
            <div>
              <span className="text-text-tertiary">Antecedência</span>
              <p className="font-medium text-text-primary tabular-nums">
                {formatDays(row.avg_booking_advance)}
              </p>
            </div>
          </div>
        </div>
      ))}
      <p className="text-[11px] text-text-tertiary text-center pt-1">
        Últimos {months} meses
      </p>
    </div>
  )

  return (
    <>
      {desktopTable}
      {mobileCards}
    </>
  )
}
