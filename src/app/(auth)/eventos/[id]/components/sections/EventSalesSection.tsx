'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  TrendingUp, ChevronDown, ExternalLink, User,
  ShoppingBag, MessageCircle, Loader2, PackageOpen,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { useEventSalesSummary } from '@/hooks/use-event-sales'
import { hasRole } from '@/config/roles'
import { VENDAS_MODULE_ROLES } from '@/config/roles'
import { cn } from '@/lib/utils'
import type { EventSalesDeal, EventSalesProduct, EventSalesContact } from '@/hooks/use-event-sales'

// ── Label helpers ──────────────────────────────────────────────

const STATUS_LABELS: Record<number, { label: string; className: string }> = {
  1: { label: 'Em aberto',  className: 'text-amber-600 bg-amber-50 border-amber-200' },
  2: { label: 'Ganho',      className: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  3: { label: 'Perdido',    className: 'text-rose-600 bg-rose-50 border-rose-200' },
}

const OUTCOME_LABELS: Record<string, string> = {
  tentou:           'Tentou contato',
  recusou:          'Recusou',
  vendeu_adicional: 'Vendeu adicional',
  vendeu_upgrade:   'Fez upgrade',
  outro:            'Outro',
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ── Sub-blocks ─────────────────────────────────────────────────

function DealHeader({ deal }: { deal: EventSalesDeal }) {
  const status = STATUS_LABELS[deal.status_id]
  const ploomesUrl = `https://app10.ploomes.com/deal/${deal.ploomes_deal_id}`

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {status && (
            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', status.className)}>
              {status.label}
            </span>
          )}
          {deal.stage_name && (
            <span className="text-xs text-text-secondary">{deal.stage_name}</span>
          )}
        </div>
        <a
          href={ploomesUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="w-3 h-3" />
          Ver no Ploomes
        </a>
      </div>

      {deal.owner_name && (
        <div className="flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
          <span className="text-sm text-text-secondary">{deal.owner_name}</span>
        </div>
      )}

      {deal.deal_amount != null && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">Valor negociado</span>
          <span className="text-sm font-semibold text-text-primary">{formatBRL(deal.deal_amount)}</span>
        </div>
      )}
    </div>
  )
}

function ProductsTable({ products }: { products: EventSalesProduct[] }) {
  if (products.length === 0) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-text-tertiary">
        <PackageOpen className="w-4 h-4 shrink-0" />
        Nenhum produto registrado no Ploomes.
      </div>
    )
  }

  const total = products.reduce((sum, p) => sum + p.total, 0)

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-default">
            <th className="text-left text-xs font-medium text-text-tertiary pb-1.5 pr-3">Categoria</th>
            <th className="text-left text-xs font-medium text-text-tertiary pb-1.5 pr-3">Produto</th>
            <th className="text-right text-xs font-medium text-text-tertiary pb-1.5 pr-3 whitespace-nowrap">Qtd</th>
            <th className="text-right text-xs font-medium text-text-tertiary pb-1.5">Total</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p, i) => (
            <tr key={i} className="border-b border-border-default/40 last:border-0">
              <td className="py-1.5 pr-3 text-text-secondary text-xs">{p.group_name ?? '—'}</td>
              <td className="py-1.5 pr-3 text-text-primary">{p.product_name ?? '—'}</td>
              <td className="py-1.5 pr-3 text-right text-text-secondary">{p.quantity}</td>
              <td className="py-1.5 text-right font-medium text-text-primary whitespace-nowrap">{formatBRL(p.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="pt-2 text-xs font-medium text-text-secondary text-right pr-3">Total</td>
            <td className="pt-2 text-right font-semibold text-text-primary whitespace-nowrap">{formatBRL(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function UpsellTimeline({ contacts }: { contacts: EventSalesContact[] }) {
  if (contacts.length === 0) {
    return (
      <p className="text-sm text-text-tertiary py-1">Nenhum contato de upsell registrado.</p>
    )
  }

  return (
    <div className="space-y-3">
      {contacts.map((c) => (
        <div key={c.id} className="flex gap-2.5">
          <div className="mt-0.5 w-2 h-2 rounded-full bg-primary/60 shrink-0 mt-1.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-text-primary">
                {OUTCOME_LABELS[c.outcome] ?? c.outcome}
              </span>
              {c.reopened_at && (
                <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">
                  Reaberto
                </span>
              )}
              <span className="text-xs text-text-tertiary ml-auto">
                {format(parseISO(c.contacted_at), "d MMM 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              {c.contacted_by_name}{c.seller_name ? ` (${c.seller_name})` : ''}
            </p>
            {c.notes && (
              <p className="text-xs text-text-secondary mt-1 italic">{c.notes}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────

interface EventSalesSectionProps {
  eventId: string
}

export function EventSalesSection({ eventId }: EventSalesSectionProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { profile } = useAuth()

  if (!hasRole(profile?.role, VENDAS_MODULE_ROLES)) return null

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { data, isLoading, isError } = useEventSalesSummary(eventId, isOpen)

  const hasData = data && (data.deal || data.products.length > 0 || data.upsell_contacts.length > 0)

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2.5 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors"
        aria-expanded={isOpen}
      >
        <TrendingUp className="w-4 h-4 text-text-secondary shrink-0" />
        <span className="text-sm font-medium text-text-primary flex-1">Vendas</span>
        {isLoading && isOpen && <Loader2 className="w-3.5 h-3.5 text-text-tertiary animate-spin" />}
        <ChevronDown className={cn('w-4 h-4 text-text-tertiary transition-transform duration-200', isOpen && 'rotate-180')} />
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 space-y-5">

            {isLoading && (
              <div className="space-y-2 pt-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-full" />
              </div>
            )}

            {isError && (
              <p className="text-sm text-destructive">Erro ao carregar dados de vendas.</p>
            )}

            {!isLoading && !isError && data && (
              <>
                {/* Header comercial */}
                {data.deal ? (
                  <div>
                    <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <ExternalLink className="w-3 h-3" />
                      Deal Ploomes
                    </p>
                    <DealHeader deal={data.deal} />
                  </div>
                ) : (
                  <p className="text-sm text-text-tertiary">Nenhum deal Ploomes vinculado.</p>
                )}

                {/* Produtos */}
                <div>
                  <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <ShoppingBag className="w-3 h-3" />
                    Produtos vendidos
                  </p>
                  <ProductsTable products={data.products} />
                </div>

                {/* Histórico upsell */}
                <div>
                  <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <MessageCircle className="w-3 h-3" />
                    Histórico de upsell
                  </p>
                  <UpsellTimeline contacts={data.upsell_contacts} />
                </div>

                {!hasData && (
                  <p className="text-sm text-text-tertiary">Nenhum dado de vendas para este evento.</p>
                )}
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
