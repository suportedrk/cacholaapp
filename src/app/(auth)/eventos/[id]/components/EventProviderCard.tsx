'use client'

import Link from 'next/link'
import { ExternalLink, MoreVertical, Check, X, Trophy, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/providers'
import { ProviderAvatar } from '@/app/(auth)/prestadores/components/ProviderAvatar'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUpdateEventProvider, useRemoveProviderFromEvent } from '@/hooks/use-event-providers'
import {
  EVENT_PROVIDER_STATUS_LABELS,
  PRICE_TYPE_LABELS,
} from '@/types/providers'
import type { EventProvider, EventProviderStatus } from '@/types/providers'

const STATUS_BADGE_CLASS: Record<EventProviderStatus, string> = {
  pending:   'badge-amber border',
  confirmed: 'badge-green border',
  cancelled: 'badge-red border',
  completed: 'badge-gray border',
}

interface Props {
  ep: EventProvider
}

export function EventProviderCard({ ep }: Props) {
  const update = useUpdateEventProvider()
  const remove = useRemoveProviderFromEvent()

  const provider = ep.provider
  if (!provider) return null

  function handleStatus(status: EventProviderStatus) {
    update.mutate({ id: ep.id, event_id: ep.event_id, provider_id: ep.provider_id, status })
  }

  async function handleRemove() {
    await remove.mutateAsync({ id: ep.id, event_id: ep.event_id, provider_id: ep.provider_id })
  }

  const statusLabel = EVENT_PROVIDER_STATUS_LABELS[ep.status]
  const priceLabel = ep.agreed_price ? formatCurrency(ep.agreed_price) : null
  const priceSuffix = ep.price_type !== 'per_event' ? ` · ${PRICE_TYPE_LABELS[ep.price_type]}` : ''

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
      <ProviderAvatar name={provider.name} size="sm" className="shrink-0 mt-0.5" />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              href={`/prestadores/${provider.id}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-text-primary hover:text-primary transition-colors"
            >
              {provider.name}
              <ExternalLink className="w-3 h-3 shrink-0 opacity-40" />
            </Link>
            {ep.category && (
              <p className="text-xs text-text-tertiary mt-0.5">{ep.category.name}</p>
            )}
          </div>

          <span className={cn(
            'shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium',
            STATUS_BADGE_CLASS[ep.status],
          )}>
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
            {statusLabel}
          </span>
        </div>

        {(priceLabel || ep.arrival_time || ep.notes) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5">
            {priceLabel && (
              <span className="text-xs font-medium text-text-secondary">
                {priceLabel}{priceSuffix}
              </span>
            )}
            {ep.arrival_time && (
              <span className="flex items-center gap-1 text-xs text-text-tertiary">
                <Clock className="w-3 h-3 shrink-0" />
                Chegada {ep.arrival_time.slice(0, 5)}
              </span>
            )}
            {ep.notes && (
              <span className="text-xs text-text-tertiary italic truncate max-w-[200px]">
                {ep.notes}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions menu */}
      <DropdownMenu>
        <DropdownMenuTrigger className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted transition-colors text-text-tertiary hover:text-text-primary">
          <MoreVertical className="w-4 h-4" />
          <span className="sr-only">Ações</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuGroup>
            {ep.status !== 'confirmed' && (
              <DropdownMenuItem onClick={() => handleStatus('confirmed')}>
                <Check className="w-3.5 h-3.5 mr-2 text-green-600" />
                Confirmar
              </DropdownMenuItem>
            )}
            {ep.status !== 'completed' && (
              <DropdownMenuItem onClick={() => handleStatus('completed')}>
                <Trophy className="w-3.5 h-3.5 mr-2 text-blue-600" />
                Concluído
              </DropdownMenuItem>
            )}
            {ep.status !== 'cancelled' && ep.status !== 'completed' && (
              <DropdownMenuItem onClick={() => handleStatus('cancelled')}>
                <X className="w-3.5 h-3.5 mr-2 text-text-secondary" />
                Cancelar
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <ConfirmDialog
            title="Remover prestador?"
            description={`Deseja remover "${provider.name}" deste evento?`}
            destructive
            onConfirm={handleRemove}
            trigger={
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="text-destructive focus:text-destructive"
              >
                Remover do evento
              </DropdownMenuItem>
            }
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
