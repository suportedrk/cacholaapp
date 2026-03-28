'use client'

import { memo } from 'react'
import Link from 'next/link'
import { format, parseISO, isFuture } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { MapPin, ShieldCheck, Wrench, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSignedUrls } from '@/hooks/use-signed-urls'
import type { Equipment } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// STATUS CONFIG
// ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<Equipment['status'], { label: string; className: string }> = {
  active:   { label: 'Ativo',        className: 'badge-green  border' },
  inactive: { label: 'Inativo',      className: 'badge-gray   border' },
  in_repair:{ label: 'Em Reparo',    className: 'badge-amber  border' },
  retired:  { label: 'Aposentado',   className: 'badge-red    border' },
}

// ─────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────

export function EquipmentCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 animate-pulse">
      <div className="flex gap-3">
        <div className="w-16 h-16 bg-muted rounded-lg shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-3 bg-muted rounded w-1/2" />
          <div className="h-3 bg-muted rounded w-1/3" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-5 w-16 bg-muted rounded-full" />
        <div className="h-5 w-20 bg-muted rounded-full" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// CARD
// ─────────────────────────────────────────────────────────────

type EquipmentCardProps = {
  equipment:        Equipment
  openMaintenance?: number   // count de manutenções abertas
}

export const EquipmentCard = memo(function EquipmentCard({ equipment: eq, openMaintenance = 0 }: EquipmentCardProps) {
  const photoPath = eq.photo_url ? [eq.photo_url] : []
  const { data: signedUrls = {} } = useSignedUrls('equipment-photos', photoPath)
  const photoSrc = eq.photo_url ? signedUrls[eq.photo_url] : null

  const statusCfg = STATUS_CONFIG[eq.status]
  const inWarranty = eq.warranty_until && isFuture(parseISO(eq.warranty_until))

  return (
    <Link
      href={`/equipamentos/${eq.id}`}
      className="block rounded-xl border bg-card p-4 card-interactive group"
    >
      <div className="flex gap-3">
        {/* Foto ou ícone placeholder */}
        <div className="w-16 h-16 rounded-lg shrink-0 overflow-hidden bg-muted flex items-center justify-center">
          {photoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoSrc}
              alt={eq.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <Package className="w-7 h-7 text-muted-foreground/50" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-1">
          <h3 className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
            {eq.name}
          </h3>
          {eq.category && (
            <p className="text-xs text-muted-foreground">{eq.category}</p>
          )}
          {eq.location && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{eq.location}</span>
            </div>
          )}
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', statusCfg.className)}>
          {statusCfg.label}
        </span>

        {inWarranty && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            <ShieldCheck className="w-3 h-3" />
            Em garantia
          </span>
        )}

        {openMaintenance > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            <Wrench className="w-3 h-3" />
            {openMaintenance} OS aberta{openMaintenance > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Garantia até */}
      {eq.warranty_until && (
        <p className="mt-2 text-xs text-muted-foreground">
          Garantia até {format(parseISO(eq.warranty_until), 'dd/MM/yyyy', { locale: ptBR })}
        </p>
      )}
    </Link>
  )
})
