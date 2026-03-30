'use client'

import { memo } from 'react'
import Link from 'next/link'
import { Phone, Mail, MessageCircle, CalendarDays, FileText, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPhone } from '@/lib/utils/providers'
import { PROVIDER_STATUS_LABELS, PROVIDER_STATUS_COLORS } from '@/types/providers'
import { ProviderAvatar } from './ProviderAvatar'
import { StarRating } from './StarRating'
import type { ServiceProviderListItem } from '@/types/providers'

// ─────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, string> = {
  active:       'badge-green border',
  inactive:     'badge-gray border',
  blocked:      'badge-red border',
  pending_docs: 'badge-amber border',
}

// ─────────────────────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────────────────────
interface Props {
  provider: ServiceProviderListItem
  animationDelay?: number
}

export const ProviderCard = memo(function ProviderCard({ provider, animationDelay = 0 }: Props) {
  const primaryContact = provider.contacts.find((c) => c.is_primary) ?? provider.contacts[0]

  // Category tags — max 3 visible + "+N" overflow
  const visibleCategories = provider.services.slice(0, 3)
  const extraCount = Math.max(0, provider.services.length - 3)

  // Ratings count — from the avg_rating denominator approximation (total_events as proxy)
  const ratingsCount = provider.total_events

  const statusBadgeClass = STATUS_BADGE[provider.status] ?? 'badge-gray border'
  const statusLabel = PROVIDER_STATUS_LABELS[provider.status] ?? provider.status

  // Doc expiry state
  const now = new Date()
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const hasExpiredDocs = (provider.expiring_docs ?? []).some(
    (d) => d.expires_at && new Date(d.expires_at) < now
  )
  const hasExpiringDocs = !hasExpiredDocs && (provider.expiring_docs ?? []).some(
    (d) => d.expires_at && new Date(d.expires_at) <= thirtyDaysLater
  )

  // WhatsApp contact (if any)
  const waContact = provider.contacts.find((c) => c.type === 'whatsapp')
  const emailContact = provider.contacts.find((c) => c.type === 'email')
  const phoneContact = provider.contacts.find((c) => c.type === 'phone')
  const displayContact = primaryContact ?? phoneContact ?? emailContact

  return (
    <article
      className="animate-fade-up"
      style={{ animationDelay: `${animationDelay}ms`, animationFillMode: 'backwards' }}
    >
      <Link
        href={`/prestadores/${provider.id}`}
        className="block group"
        aria-label={`Ver detalhes de ${provider.name}`}
      >
        <div className={cn(
          'relative rounded-xl border bg-card p-4 flex flex-col gap-3 card-interactive overflow-hidden',
          provider.status === 'blocked' && 'opacity-75',
        )}>

          {/* ── Row 1: avatar + nome + status badge ── */}
          <div className="flex items-start gap-3">
            <ProviderAvatar name={provider.name} size="md" />

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground text-sm leading-snug truncate group-hover:text-primary transition-colors">
                {provider.name}
              </h3>
              {provider.legal_name && provider.legal_name !== provider.name && (
                <p className="text-xs text-muted-foreground truncate">{provider.legal_name}</p>
              )}
              <p className="text-xs text-muted-foreground/70 font-mono mt-0.5">
                {provider.document_number}
              </p>
            </div>

            <span className={cn(
              'shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
              statusBadgeClass,
            )}>
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
              {statusLabel}
            </span>
          </div>

          {/* ── Row 2: estrelas ── */}
          {provider.avg_rating > 0 ? (
            <StarRating
              rating={provider.avg_rating}
              showValue
              showCount
              count={ratingsCount}
              size="sm"
            />
          ) : (
            <p className="text-xs text-muted-foreground/60 italic">Sem avaliações ainda</p>
          )}

          {/* ── Row 3: categorias / tags ── */}
          {provider.services.length > 0 && (
            <div className="flex flex-wrap gap-1.5" aria-label="Categorias">
              {visibleCategories.map((svc) => (
                <span
                  key={svc.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border"
                >
                  {svc.category?.icon && (
                    <span aria-hidden="true">{svc.category.icon}</span>
                  )}
                  {svc.category?.name ?? 'Categoria'}
                </span>
              ))}
              {extraCount > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                  +{extraCount}
                </span>
              )}
            </div>
          )}

          {/* ── Row 4: contato principal ── */}
          {displayContact && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {displayContact.type === 'phone' && (
                <>
                  <Phone className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span>{formatPhone(displayContact.value)}</span>
                </>
              )}
              {displayContact.type === 'whatsapp' && (
                <>
                  <MessageCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span>{formatPhone(displayContact.value)}</span>
                </>
              )}
              {displayContact.type === 'email' && (
                <>
                  <Mail className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{displayContact.value}</span>
                </>
              )}
            </div>
          )}

          {/* ── Row 5: métricas ── */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground border-t border-border pt-2.5 mt-0.5">
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3 h-3 shrink-0" aria-hidden="true" />
              {provider.total_events} {provider.total_events === 1 ? 'festa' : 'festas'}
            </span>
            <span className="text-border">·</span>
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3 shrink-0" aria-hidden="true" />
              {provider.documents_count} {provider.documents_count === 1 ? 'doc' : 'docs'}
            </span>
            {provider.upcoming_events_count > 0 && (
              <>
                <span className="text-border">·</span>
                <span className="flex items-center gap-1 text-primary font-medium">
                  {provider.upcoming_events_count} agendado{provider.upcoming_events_count > 1 ? 's' : ''}
                </span>
              </>
            )}
            {(hasExpiredDocs || hasExpiringDocs) && (
              <>
                <span className="text-border">·</span>
                <span className={cn(
                  'flex items-center gap-1 font-medium',
                  hasExpiredDocs ? 'text-destructive' : 'text-amber-600 dark:text-amber-400',
                )}>
                  <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
                  {hasExpiredDocs ? 'Doc vencido' : 'Doc vencendo'}
                </span>
              </>
            )}
          </div>

          {/* ── Quick actions (mobile — visible sempre, desktop via hover) ── */}
          {(waContact || emailContact) && (
            <div
              className="flex items-center gap-2 pt-1"
              onClick={(e) => e.preventDefault()} // prevent Link click
            >
              {waContact && (
                <a
                  href={`https://wa.me/55${waContact.value.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`WhatsApp de ${provider.name}`}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MessageCircle className="w-3 h-3" aria-hidden="true" />
                  WhatsApp
                </a>
              )}
              {emailContact && (
                <a
                  href={`mailto:${emailContact.value}`}
                  aria-label={`E-mail de ${provider.name}`}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Mail className="w-3 h-3" aria-hidden="true" />
                  E-mail
                </a>
              )}
            </div>
          )}
        </div>
      </Link>
    </article>
  )
})
