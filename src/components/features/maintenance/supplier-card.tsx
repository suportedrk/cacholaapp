'use client'

import { memo } from 'react'
import Link from 'next/link'
import { Building2, Phone, Mail, Users, FileText } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { SupplierRating } from './supplier-rating'
import { cn } from '@/lib/utils'
import type { SupplierWithCounts } from '@/hooks/use-suppliers'
import type { FilterChipColor } from '@/components/shared/filter-chip'

// ─────────────────────────────────────────────────────────────
// CATEGORY COLORS
// ─────────────────────────────────────────────────────────────
const CATEGORY_COLOR: Record<string, FilterChipColor> = {
  'Refrigeração': 'blue',
  'Elétrica':     'amber',
  'Hidráulica':   'brand',
  'Pintura':      'purple',
  'Serralheria':  'gray',
  'Jardinagem':   'green',
  'Limpeza':      'blue',
  'Geral':        'gray',
  'Outra':        'gray',
}

const BADGE_CLASS: Record<FilterChipColor, string> = {
  brand:  'badge-brand  border',
  amber:  'badge-amber  border',
  red:    'badge-red    border',
  green:  'badge-green  border',
  blue:   'badge-blue   border',
  purple: 'badge-purple border',
  orange: 'badge-orange border',
  gray:   'badge-gray   border',
}

// ─────────────────────────────────────────────────────────────
// CARD
// ─────────────────────────────────────────────────────────────
interface Props {
  supplier: SupplierWithCounts
}

export const SupplierCard = memo(function SupplierCard({ supplier }: Props) {
  const primaryContact = supplier.contacts.find((c) => c.is_primary) ?? supplier.contacts[0]
  const docCount = supplier.documents_count?.[0]?.count ?? 0
  const categoryColor = CATEGORY_COLOR[supplier.category ?? ''] ?? 'gray'

  return (
    <Link href={`/manutencao/fornecedores/${supplier.id}`} className="block group">
      <article className={cn(
        'bg-card rounded-xl border border-border card-interactive p-4 space-y-3',
        !supplier.is_active && 'opacity-60',
      )}>
        {/* ── Header: avatar + nome + rating ──────────────────── */}
        <div className="flex items-start gap-3">
          {/* Avatar icon */}
          <div className="shrink-0 w-10 h-10 rounded-full bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-700 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-foreground leading-snug group-hover:text-primary transition-colors truncate">
                  {supplier.company_name}
                </p>
                {supplier.trade_name && (
                  <p className="text-xs text-muted-foreground truncate">
                    {supplier.trade_name}
                  </p>
                )}
              </div>
              {!supplier.is_active && (
                <span className="shrink-0 badge-gray border text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                  Inativo
                </span>
              )}
            </div>

            {/* Rating */}
            {supplier.rating != null && (
              <SupplierRating value={supplier.rating} size="sm" className="mt-1" />
            )}
          </div>
        </div>

        {/* ── Category badge ───────────────────────────────────── */}
        {supplier.category && (
          <div>
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
              BADGE_CLASS[categoryColor],
            )}>
              {supplier.category}
            </span>
          </div>
        )}

        {/* ── Primary contact info ─────────────────────────────── */}
        {primaryContact && (
          <div className="space-y-1">
            {(primaryContact.phone ?? supplier.phone) && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Phone className="w-3 h-3 shrink-0" />
                <span>{primaryContact.phone ?? supplier.phone}</span>
              </div>
            )}
            {(primaryContact.email ?? supplier.email) && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="w-3 h-3 shrink-0" />
                <span className="truncate">{primaryContact.email ?? supplier.email}</span>
              </div>
            )}
          </div>
        )}

        {/* Fallback: supplier-level contact if no contacts */}
        {!primaryContact && (supplier.phone || supplier.email) && (
          <div className="space-y-1">
            {supplier.phone && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Phone className="w-3 h-3 shrink-0" />
                <span>{supplier.phone}</span>
              </div>
            )}
            {supplier.email && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="w-3 h-3 shrink-0" />
                <span className="truncate">{supplier.email}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Footer: counts + CNPJ ────────────────────────────── */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users className="w-3 h-3" />
              {supplier.contacts.length}
            </span>
            <span className="inline-flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {docCount}
            </span>
          </div>
          {supplier.cnpj && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {supplier.cnpj}
            </span>
          )}
        </div>
      </article>
    </Link>
  )
})

// ─────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────
export function SupplierCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="w-10 h-10 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-5 w-20 rounded-full" />
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-3 w-44" />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  )
}
