// NOTA: internamente usa "seller/sellers" por motivos históricos, mas a UI exibe
// "Responsável por Deal" pois o campo reflete OwnerId do Ploomes (atendimento ao
// cliente), não vendedor individual por produto/serviço.

'use client'

import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SellerRankingRow } from '@/hooks/use-bi-sellers-ranking'

// ── Helpers ───────────────────────────────────────────────────

function formatCurrency(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(1)}k`
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const AVATAR_COLORS = [
  'bg-primary text-white',
  'bg-blue-500 text-white',
  'bg-violet-500 text-white',
  'bg-amber-600 text-white',
  'bg-rose-500 text-white',
  'bg-teal-600 text-white',
  'bg-orange-500 text-white',
  'bg-indigo-500 text-white',
]

function getAvatarColor(name: string): string {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

// ── Sort logic ────────────────────────────────────────────────

type SortKey = 'leads_count' | 'won_count' | 'conversion_rate' | 'avg_ticket' | 'total_revenue' | 'open_count'
type SortDir = 'asc' | 'desc'

interface SortState { key: SortKey; dir: SortDir }

// ── Props ─────────────────────────────────────────────────────

interface Props {
  rows: SellerRankingRow[]
  onSelectSeller: (name: string) => void
}

// ── Column header ─────────────────────────────────────────────

function ColHeader({
  label, sortKey, current, onSort,
  className,
}: {
  label: string
  sortKey: SortKey
  current: SortState
  onSort: (k: SortKey) => void
  className?: string
}) {
  const isActive = current.key === sortKey
  return (
    <th
      className={cn(
        'px-3 py-2.5 text-right text-xs font-semibold text-text-secondary cursor-pointer select-none whitespace-nowrap',
        'hover:text-text-primary transition-colors',
        className,
      )}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1 justify-end">
        {label}
        {isActive ? (
          current.dir === 'desc'
            ? <ChevronDown className="w-3 h-3 text-primary" />
            : <ChevronUp   className="w-3 h-3 text-primary" />
        ) : (
          <ChevronsUpDown className="w-3 h-3 opacity-30" />
        )}
      </span>
    </th>
  )
}

// ── Component ─────────────────────────────────────────────────

export function SellersRankingTable({ rows, onSelectSeller }: Props) {
  const [sort, setSort] = useState<SortState>({ key: 'total_revenue', dir: 'desc' })

  const handleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { key, dir: 'desc' },
    )
  }

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sort.key] as number
      const bv = b[sort.key] as number
      return sort.dir === 'desc' ? bv - av : av - bv
    })
  }, [rows, sort])

  // Compute "bests" from original data (not sorted) for badges
  const best = useMemo(() => ({
    conversion_rate: Math.max(...rows.map((r) => r.conversion_rate)),
    avg_ticket:      Math.max(...rows.map((r) => r.avg_ticket)),
    total_revenue:   Math.max(...rows.map((r) => r.total_revenue)),
  }), [rows])

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-2 text-center">
        <p className="text-sm text-text-secondary">
          Nenhum responsável com atividade no período selecionado.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border-default">
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-text-secondary w-8">#</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-text-secondary">Responsável</th>
            <ColHeader label="Leads"     sortKey="leads_count"     current={sort} onSort={handleSort} />
            <ColHeader label="Ganhos"    sortKey="won_count"       current={sort} onSort={handleSort} className="hidden sm:table-cell" />
            <ColHeader label="Conv%"     sortKey="conversion_rate" current={sort} onSort={handleSort} />
            <ColHeader label="Ticket"    sortKey="avg_ticket"      current={sort} onSort={handleSort} className="hidden md:table-cell" />
            <ColHeader label="Receita"   sortKey="total_revenue"   current={sort} onSort={handleSort} />
            <ColHeader label="Em aberto" sortKey="open_count"      current={sort} onSort={handleSort} className="hidden lg:table-cell" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, idx) => {
            const isBestConv    = row.conversion_rate === best.conversion_rate && best.conversion_rate > 0
            const isBestTicket  = row.avg_ticket === best.avg_ticket && best.avg_ticket > 0
            const isBestRevenue = row.total_revenue === best.total_revenue && best.total_revenue > 0
            const initials      = getInitials(row.owner_name)
            const avatarColor   = getAvatarColor(row.owner_name)

            return (
              <tr
                key={row.owner_name}
                onClick={() => onSelectSeller(row.owner_name)}
                className="border-b border-border-default last:border-0 hover:bg-muted/40 cursor-pointer transition-colors"
              >
                {/* Pos */}
                <td className="px-3 py-3 text-xs text-text-tertiary tabular-nums">
                  {idx + 1}
                </td>

                {/* Vendedora */}
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className={cn(
                      'w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold',
                      avatarColor,
                    )}>
                      {initials}
                    </div>
                    <span className="font-medium text-text-primary truncate max-w-[140px]">
                      {row.owner_name}
                    </span>
                  </div>
                </td>

                {/* Leads */}
                <td className="px-3 py-3 text-right tabular-nums text-text-secondary">
                  {row.leads_count.toLocaleString('pt-BR')}
                </td>

                {/* Ganhos */}
                <td className="px-3 py-3 text-right tabular-nums text-text-secondary hidden sm:table-cell">
                  {row.won_count.toLocaleString('pt-BR')}
                </td>

                {/* Conv% */}
                <td className="px-3 py-3 text-right tabular-nums">
                  <span className="inline-flex items-center gap-1 justify-end">
                    {isBestConv && (
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-400 shrink-0" />
                    )}
                    <span className={cn(
                      'font-medium',
                      isBestConv ? 'text-green-600 dark:text-green-400' : 'text-text-secondary',
                    )}>
                      {row.conversion_rate.toFixed(1)}%
                    </span>
                  </span>
                </td>

                {/* Ticket */}
                <td className="px-3 py-3 text-right tabular-nums text-text-secondary hidden md:table-cell">
                  <span className={cn(
                    isBestTicket ? 'text-primary font-medium' : '',
                  )}>
                    {isBestTicket && (
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-400 shrink-0 inline mr-1" />
                    )}
                    {formatCurrency(row.avg_ticket)}
                  </span>
                </td>

                {/* Receita */}
                <td className="px-3 py-3 text-right tabular-nums">
                  <span className={cn(
                    'font-medium',
                    isBestRevenue ? 'text-primary' : 'text-text-secondary',
                  )}>
                    {isBestRevenue && (
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-400 shrink-0 inline mr-1" />
                    )}
                    {formatCurrency(row.total_revenue)}
                  </span>
                </td>

                {/* Em aberto */}
                <td className="px-3 py-3 text-right tabular-nums text-text-secondary hidden lg:table-cell">
                  {row.open_count.toLocaleString('pt-BR')}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
