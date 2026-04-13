'use client'

import { ExternalLink, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PloomesDealsRow } from '@/types/database.types'

// ── Types ─────────────────────────────────────────────────────

interface Props {
  deal: PloomesDealsRow
}

// ── Helpers ───────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatCurrency(value: number | null | undefined): string | null {
  if (value == null || value === 0) return null
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// ── Status badge config ────────────────────────────────────────

const STATUS_CONFIG: Record<number, { label: string; className: string }> = {
  1: { label: 'Em aberto', className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' },
  2: { label: 'Ganho',     className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' },
  3: { label: 'Perdido',   className: 'bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700' },
}

// ── Component ─────────────────────────────────────────────────

export function DrilldownDealCard({ deal }: Props) {
  const status  = STATUS_CONFIG[deal.status_id] ?? STATUS_CONFIG[1]
  const amount  = formatCurrency(deal.deal_amount)
  const created = formatDate(deal.ploomes_create_date)
  const eventDt = formatDate(deal.event_date)
  const ploomesUrl = `https://app10.ploomes.com/deal/${deal.ploomes_deal_id}`

  return (
    <div className="rounded-lg border border-border-default bg-surface-secondary hover:border-border-strong transition-colors p-3 space-y-1.5">
      {/* Title + status badge */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-text-primary leading-snug line-clamp-2 flex-1">
          {deal.title || '(sem título)'}
        </p>
        <span className={cn(
          'shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded-full border whitespace-nowrap',
          status.className,
        )}>
          {status.label}
        </span>
      </div>

      {/* Contact name */}
      {deal.contact_name && (
        <p className="text-xs text-text-secondary">{deal.contact_name}</p>
      )}

      {/* Amount + create date */}
      <p className="text-xs text-text-tertiary">
        {amount && (
          <span className="text-text-secondary font-medium">{amount} · </span>
        )}
        Criado em {created}
      </p>

      {/* Event date */}
      {eventDt && (
        <p className="text-xs text-text-secondary flex items-center gap-1">
          <Calendar className="w-3 h-3 shrink-0" />
          Festa: {eventDt}
        </p>
      )}

      {/* Ploomes link */}
      <a
        href={ploomesUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-text-link hover:underline"
      >
        Ver no Ploomes
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  )
}
