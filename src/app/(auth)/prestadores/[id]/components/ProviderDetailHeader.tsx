'use client'

import { useRouter } from 'next/navigation'
import { Pencil, Phone, Mail, MoreVertical, MessageCircle, MapPin, PartyPopper } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPhone, formatCPF, formatCNPJ } from '@/lib/utils/providers'
import { PROVIDER_STATUS_LABELS, PROVIDER_STATUS_COLORS } from '@/types/providers'
import { ProviderAvatar } from '../../components/ProviderAvatar'
import { StarRating } from '../../components/StarRating'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUpdateProvider, useDeleteProvider } from '@/hooks/use-providers'
import type { ServiceProviderWithDetails } from '@/types/providers'

// ── Status badge helpers ─────────────────────────────────────
const STATUS_BADGE_CLASS: Record<string, string> = {
  active:       'badge-green border',
  inactive:     'badge-gray border',
  blocked:      'badge-red border',
  pending_docs: 'badge-amber border',
}

// ── Format document display ──────────────────────────────────
function formatDocument(type: string, number: string): string {
  if (type === 'cnpj') return formatCNPJ(number)
  return formatCPF(number)
}

// ── Primary contact helpers ──────────────────────────────────
function getWhatsAppUrl(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`
  return `https://wa.me/${withCountry}`
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
interface Props {
  provider: ServiceProviderWithDetails
}

export function ProviderDetailHeader({ provider }: Props) {
  const router = useRouter()
  const updateProvider = useUpdateProvider()
  const deleteProvider = useDeleteProvider()

  const primaryContact = provider.contacts.find((c) => c.is_primary) ?? provider.contacts[0]
  const waContact = provider.contacts.find((c) => c.type === 'whatsapp') ?? primaryContact
  const emailContact = provider.contacts.find((c) => c.type === 'email')

  const waUrl = waContact ? getWhatsAppUrl(waContact.value) : null
  const mailUrl = emailContact ? `mailto:${emailContact.value}` : null

  const statusClass = STATUS_BADGE_CLASS[provider.status] ?? 'badge-gray border'
  const statusLabel = PROVIDER_STATUS_LABELS[provider.status]

  // Service categories from provider.services (deduplicated)
  const services = provider.services ?? []

  const location = [provider.city, provider.state].filter(Boolean).join(', ')

  function handleToggleStatus() {
    const newStatus = provider.status === 'active' ? 'inactive' : 'active'
    updateProvider.mutate({ id: provider.id, status: newStatus })
  }

  function handleBlock() {
    updateProvider.mutate({ id: provider.id, status: 'blocked' })
  }

  async function handleDelete() {
    await deleteProvider.mutateAsync(provider.id)
    router.push('/prestadores')
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      {/* Row 1: avatar + info + status badge */}
      <div className="flex items-start gap-3">
        <ProviderAvatar name={provider.name} size="lg" className="shrink-0" />

        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-foreground leading-snug">
            {provider.name}
          </h1>
          {provider.legal_name && provider.legal_name !== provider.name && (
            <p className="text-xs text-muted-foreground truncate">{provider.legal_name}</p>
          )}
          <p className="text-xs text-muted-foreground/70 font-mono mt-0.5">
            {formatDocument(provider.document_type, provider.document_number)}
          </p>
        </div>

        <span className={cn(
          'shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
          statusClass,
        )}>
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
          {statusLabel}
        </span>
      </div>

      {/* Row 2: rating */}
      {provider.avg_rating > 0 ? (
        <StarRating
          rating={provider.avg_rating}
          size="md"
          showValue
          showCount
          count={provider.total_events}
        />
      ) : (
        <p className="text-xs text-muted-foreground/60 italic">Sem avaliações ainda</p>
      )}

      {/* Row 3: category pills */}
      {services.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {services.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium badge-gray border"
            >
              <span>{s.category?.icon ?? '🔧'}</span>
              {s.category?.name ?? 'Serviço'}
            </span>
          ))}
        </div>
      )}

      {/* Row 4: location + events count */}
      {(location || provider.total_events > 0) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {location && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" />
              {location}
            </span>
          )}
          {provider.total_events > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <PartyPopper className="w-3.5 h-3.5" />
              {provider.total_events} {provider.total_events === 1 ? 'festa realizada' : 'festas realizadas'}
            </span>
          )}
        </div>
      )}

      {/* Row 5: action buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => router.push(`/prestadores/${provider.id}/editar`)}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          Editar
        </button>

        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-muted transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            WhatsApp
          </a>
        )}

        {mailUrl && (
          <a
            href={mailUrl}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-muted transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            E-mail
          </a>
        )}

        {/* More menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Mais opções"
          >
            <MoreVertical className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuGroup>
              {primaryContact && (
                <DropdownMenuItem onClick={() => {
                  window.location.href = `tel:${primaryContact.value.replace(/\D/g, '')}`
                }}>
                  <Phone className="w-4 h-4 mr-2" />
                  Ligar
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleToggleStatus}>
                {provider.status === 'active' ? 'Desativar' : 'Ativar'}
              </DropdownMenuItem>
              {provider.status !== 'blocked' && (
                <DropdownMenuItem
                  onClick={handleBlock}
                  className="text-destructive focus:text-destructive"
                >
                  Bloquear
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <ConfirmDialog
              title="Excluir prestador?"
              description={`Tem certeza que deseja excluir "${provider.name}"? Esta ação não pode ser desfeita.`}
              destructive
              onConfirm={handleDelete}
              trigger={
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className="text-destructive focus:text-destructive"
                >
                  Excluir
                </DropdownMenuItem>
              }
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
