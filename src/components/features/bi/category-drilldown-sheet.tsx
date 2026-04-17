'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, AlertCircle, Tag, Users2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useBiCategoryDrilldown } from '@/hooks/use-bi-category'
import type { BICategoryDrilldownRow } from '@/hooks/use-bi-category'

// ── Helpers ───────────────────────────────────────────────────

function formatCurrency(v: number | null | undefined): string {
  if (v == null) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
  }).format(v)
}

const PRODUCT_PAGE_SIZE = 20

// ── Props ─────────────────────────────────────────────────────

interface Props {
  category:        string | null
  startDate:       string
  endDate:         string
  unitId:          string | null
  includeInactive: boolean
  open:            boolean
  onOpenChange:    (open: boolean) => void
}

// ── Component ─────────────────────────────────────────────────

export function CategoryDrilldownSheet({
  category,
  startDate,
  endDate,
  unitId,
  includeInactive,
  open,
  onOpenChange,
}: Props) {
  const [productPage, setProductPage] = useState(0)

  const { data = [], isLoading, isError } = useBiCategoryDrilldown({
    category,
    startDate,
    endDate,
    unitId,
    includeInactive,
  })

  const products = data.filter((r): r is BICategoryDrilldownRow & { kind: 'product' } =>
    r.kind === 'product'
  )
  const sellers  = data.filter((r): r is BICategoryDrilldownRow & { kind: 'seller' } =>
    r.kind === 'seller'
  )

  const totalProductPages = Math.ceil(products.length / PRODUCT_PAGE_SIZE)
  const pagedProducts     = products.slice(
    productPage * PRODUCT_PAGE_SIZE,
    (productPage + 1) * PRODUCT_PAGE_SIZE,
  )

  function handleOpenChange(v: boolean) {
    onOpenChange(v)
    if (!v) setProductPage(0)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        showCloseButton
        className="w-full sm:max-w-xl flex flex-col gap-0 p-0"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b border-border-default">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-text-tertiary shrink-0" />
            <SheetTitle className="text-base font-semibold truncate">
              {category ?? '—'}
            </SheetTitle>
          </div>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="px-6 py-4 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="skeleton-shimmer h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-2 py-12 text-text-secondary">
              <AlertCircle className="h-6 w-6 text-status-error-text" />
              <p className="text-sm">Erro ao carregar drill-down.</p>
            </div>
          ) : data.length === 0 ? (
            <div className="py-12 text-center text-text-tertiary text-sm">
              Nenhum produto encontrado no período.
            </div>
          ) : (
            <div className="divide-y divide-border-default">

              {/* ── Seção 1: Produtos ──────────────────────────── */}
              <div>
                <div className="flex items-center gap-2 px-6 py-3 bg-surface-secondary">
                  <Tag className="h-3.5 w-3.5 text-text-tertiary" />
                  <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                    Produtos desta categoria
                  </span>
                  <span className="text-xs text-text-tertiary ml-auto">
                    {products.length} produto{products.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {products.length === 0 ? (
                  <p className="px-6 py-4 text-sm text-text-tertiary">
                    Nenhum produto encontrado.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-surface-secondary/50 text-text-secondary">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-medium">Produto</th>
                        <th className="text-right px-4 py-2.5 font-medium">Receita</th>
                        <th className="text-right px-4 py-2.5 font-medium hidden sm:table-cell">Qtd</th>
                        <th className="text-right px-4 py-2.5 font-medium hidden sm:table-cell">Ticket médio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-default">
                      {pagedProducts.map((row) => (
                        <tr key={row.item_name} className="hover:bg-surface-secondary transition-colors">
                          <td className="px-4 py-2.5 text-text-primary max-w-[180px] truncate">
                            <span className="text-xs text-text-tertiary mr-1.5">
                              {row.rank_position}.
                            </span>
                            {row.item_name ?? '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-text-primary whitespace-nowrap">
                            {formatCurrency(row.item_revenue)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-text-secondary hidden sm:table-cell">
                            {row.item_count.toLocaleString('pt-BR')}
                          </td>
                          <td className="px-4 py-2.5 text-right text-text-secondary hidden sm:table-cell whitespace-nowrap">
                            {formatCurrency(row.item_avg)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Pagination */}
                {totalProductPages > 1 && (
                  <div className="px-6 py-3 border-t border-border-default flex items-center justify-between text-sm text-text-secondary">
                    <span>
                      {productPage * PRODUCT_PAGE_SIZE + 1}–{Math.min((productPage + 1) * PRODUCT_PAGE_SIZE, products.length)} de {products.length}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        disabled={productPage === 0}
                        onClick={() => setProductPage((p) => p - 1)}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        disabled={productPage >= totalProductPages - 1}
                        onClick={() => setProductPage((p) => p + 1)}
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Seção 2: Top 5 vendedoras ──────────────────── */}
              {sellers.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 px-6 py-3 bg-surface-secondary">
                    <Users2 className="h-3.5 w-3.5 text-text-tertiary" />
                    <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                      Top 5 vendedoras
                    </span>
                  </div>
                  <div className="divide-y divide-border-default">
                    {sellers.map((row) => (
                      <div key={row.item_name} className="flex items-center gap-3 px-6 py-3">
                        <span className="text-xs text-text-tertiary w-4 shrink-0 text-right">
                          {row.rank_position}.
                        </span>
                        <span className="flex-1 font-medium text-text-primary text-sm truncate">
                          {row.item_name ?? '—'}
                        </span>
                        <span className="text-sm font-semibold text-text-primary whitespace-nowrap">
                          {formatCurrency(row.item_revenue)}
                        </span>
                        <span className="text-xs text-text-tertiary hidden sm:inline whitespace-nowrap">
                          {row.item_count} item{row.item_count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
