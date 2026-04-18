'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { SellerOrdersDrilldownSheet } from '@/components/features/bi/seller-orders-drilldown-sheet'
import type { VendasRankingRow } from '@/hooks/use-vendas'
import type { BISalesRankingRow } from '@/hooks/use-bi-sales'

// ── Helpers ───────────────────────────────────────────────────

function formatCurrency(v: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
  }).format(v)
}

type SortKey = 'total_revenue' | 'order_count' | 'avg_ticket'
type SortDir = 'asc' | 'desc'

function SortIcon({ field, sortKey, sortDir }: { field: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (field !== sortKey) return <ChevronsUpDown className="w-3 h-3 opacity-30" />
  return sortDir === 'desc'
    ? <ChevronDown className="w-3 h-3" />
    : <ChevronUp className="w-3 h-3" />
}

// ── Props ─────────────────────────────────────────────────────

interface Props {
  rows:           VendasRankingRow[]
  isLoading:      boolean
  canDrilldown:   boolean   // true = manager; false = vendedora
  mySellerName:   string | null  // highlight own row for vendedora
  startDate:      string
  endDate:        string
  unitId:         string | null
}

// ── Component ─────────────────────────────────────────────────

export function RankingTable({
  rows,
  isLoading,
  canDrilldown,
  mySellerName,
  startDate,
  endDate,
  unitId,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('total_revenue')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [drilldownSeller, setDrilldownSeller] = useState<BISalesRankingRow | null>(null)

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const mul = sortDir === 'desc' ? -1 : 1
    return (a[sortKey] - b[sortKey]) * mul
  })

  const thClass = 'px-4 py-2.5 text-left text-xs font-medium text-text-secondary select-none cursor-pointer hover:text-text-primary transition-colors'

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="skeleton-shimmer h-11 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="py-10 text-center text-text-tertiary text-sm">
        Nenhuma vendedora com orders no período.
      </div>
    )
  }

  return (
    <>
      <div className="rounded-xl border border-border-default overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary w-8">#</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary">Vendedora</th>
              <th className={thClass} onClick={() => handleSort('total_revenue')}>
                <span className="inline-flex items-center gap-1">
                  Receita
                  <SortIcon field="total_revenue" sortKey={sortKey} sortDir={sortDir} />
                </span>
              </th>
              <th className={cn(thClass, 'hidden sm:table-cell')} onClick={() => handleSort('order_count')}>
                <span className="inline-flex items-center gap-1">
                  Orders
                  <SortIcon field="order_count" sortKey={sortKey} sortDir={sortDir} />
                </span>
              </th>
              <th className={cn(thClass, 'hidden md:table-cell')} onClick={() => handleSort('avg_ticket')}>
                <span className="inline-flex items-center gap-1">
                  Ticket médio
                  <SortIcon field="avg_ticket" sortKey={sortKey} sortDir={sortDir} />
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {sorted.map((row, idx) => {
              const isMe = mySellerName
                ? row.seller_name === mySellerName
                : false

              return (
                <tr
                  key={row.seller_id}
                  onClick={() => {
                    if (!canDrilldown) return
                    // Map VendasRankingRow → BISalesRankingRow shape for SellerOrdersDrilldownSheet
                    setDrilldownSeller({
                      seller_id:          row.seller_id,
                      seller_name:        row.seller_name,
                      seller_status:      'active',
                      is_system_account:  false,
                      hire_date:          null,
                      termination_date:   null,
                      total_revenue:      row.total_revenue,
                      order_count:        row.order_count,
                      avg_ticket:         row.avg_ticket,
                      months_worked:      1,
                      avg_monthly_revenue: row.total_revenue,
                    })
                  }}
                  className={cn(
                    'transition-colors',
                    isMe && 'bg-brand-50 dark:bg-brand-950',
                    canDrilldown && 'cursor-pointer hover:bg-surface-secondary',
                  )}
                >
                  <td className="px-4 py-2.5 text-text-tertiary text-xs">{idx + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-text-primary">
                    <span className={cn(isMe && 'text-primary font-semibold')}>
                      {row.seller_name}
                      {isMe && <span className="ml-1.5 text-xs font-normal text-text-tertiary">(você)</span>}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-text-primary font-medium">
                    {formatCurrency(row.total_revenue)}
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary hidden sm:table-cell">
                    {row.order_count}
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary hidden md:table-cell">
                    {formatCurrency(row.avg_ticket)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {canDrilldown && (
        <SellerOrdersDrilldownSheet
          seller={drilldownSeller}
          startDate={startDate}
          endDate={endDate}
          unitId={unitId}
          open={drilldownSeller !== null}
          onOpenChange={(open) => { if (!open) setDrilldownSeller(null) }}
        />
      )}
    </>
  )
}
