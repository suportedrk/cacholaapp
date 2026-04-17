'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ExternalLink, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useBiSellerOrders } from '@/hooks/use-bi-sales'
import type { BISalesRankingRow } from '@/hooks/use-bi-sales'

// ── Helpers ───────────────────────────────────────────────────

function formatCurrency(v: number | null | undefined): string {
  if (v == null) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
  }).format(v)
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return format(parseISO(iso), 'dd/MM/yyyy', { locale: ptBR })
  } catch {
    return '—'
  }
}

const PAGE_SIZE = 20

// ── Props ─────────────────────────────────────────────────────

interface Props {
  seller:        BISalesRankingRow | null
  startDate:     string
  endDate:       string
  unitId:        string | null
  open:          boolean
  onOpenChange:  (open: boolean) => void
}

// ── Component ─────────────────────────────────────────────────

export function SellerOrdersDrilldownSheet({
  seller,
  startDate,
  endDate,
  unitId,
  open,
  onOpenChange,
}: Props) {
  const [page, setPage] = useState(0)

  const { data: orders = [], isLoading, isError } = useBiSellerOrders({
    sellerId:  seller?.seller_id ?? null,
    startDate,
    endDate,
    unitId,
  })

  // Reset page when seller changes
  const totalPages = Math.ceil(orders.length / PAGE_SIZE)
  const paged      = orders.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const statusLabel = seller?.seller_status === 'inactive' ? 'inativa' : undefined
  const systemLabel = seller?.is_system_account ? 'sistema' : undefined

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); setPage(0) }}>
      <SheetContent
        side="right"
        showCloseButton
        className="w-full sm:max-w-xl flex flex-col gap-0 p-0"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b border-border-default">
          <div className="flex items-center gap-2 flex-wrap">
            <SheetTitle className="text-base font-semibold">
              {seller?.seller_name ?? '—'}
            </SheetTitle>
            {statusLabel && (
              <Badge variant="outline" className="badge-gray border text-xs">
                {statusLabel}
              </Badge>
            )}
            {systemLabel && (
              <Badge variant="outline" className="badge-amber border text-xs">
                {systemLabel}
              </Badge>
            )}
          </div>
          <p className="text-xs text-text-tertiary mt-0.5">
            {formatDate(startDate)} — {formatDate(endDate)}
          </p>
        </SheetHeader>

        {/* KPI strip */}
        {seller && (
          <div className="grid grid-cols-3 divide-x divide-border-default border-b border-border-default">
            <div className="px-4 py-3 text-center">
              <div className="text-xs text-text-tertiary mb-0.5">Receita</div>
              <div className="text-sm font-semibold text-text-primary">
                {formatCurrency(seller.total_revenue)}
              </div>
            </div>
            <div className="px-4 py-3 text-center">
              <div className="text-xs text-text-tertiary mb-0.5">Orders</div>
              <div className="text-sm font-semibold text-text-primary">
                {seller.order_count}
              </div>
            </div>
            <div className="px-4 py-3 text-center">
              <div className="text-xs text-text-tertiary mb-0.5">Ticket médio</div>
              <div className="text-sm font-semibold text-text-primary">
                {formatCurrency(seller.avg_ticket)}
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="px-6 py-4 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="skeleton-shimmer h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-2 py-12 text-text-secondary">
              <AlertCircle className="h-6 w-6 text-status-error-text" />
              <p className="text-sm">Erro ao carregar orders.</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-12 text-center text-text-tertiary text-sm">
              Nenhuma order encontrada no período.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface-secondary text-text-secondary sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Data</th>
                  <th className="text-left px-4 py-2.5 font-medium">Cliente</th>
                  <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Unidade</th>
                  <th className="text-right px-4 py-2.5 font-medium">Valor</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {paged.map((order) => (
                  <tr key={order.ploomes_order_id} className="hover:bg-surface-secondary transition-colors">
                    <td className="px-4 py-2.5 text-text-secondary whitespace-nowrap">
                      {formatDate(order.order_date)}
                    </td>
                    <td className="px-4 py-2.5 text-text-primary max-w-[160px] truncate">
                      {order.client_name}
                    </td>
                    <td className="px-4 py-2.5 text-text-secondary hidden sm:table-cell">
                      {order.unit_name}
                    </td>
                    <td className="px-4 py-2.5 text-text-primary font-medium text-right whitespace-nowrap">
                      {formatCurrency(order.amount)}
                    </td>
                    <td className="px-3 py-2.5">
                      {order.deal_id && (
                        <a
                          href={`https://app10.ploomes.com/deal/${order.deal_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-surface-tertiary text-text-tertiary hover:text-text-primary transition-colors"
                          aria-label="Abrir deal no Ploomes"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-border-default flex items-center justify-between text-sm text-text-secondary">
            <span>
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, orders.length)} de {orders.length}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
