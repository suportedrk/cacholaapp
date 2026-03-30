'use client'

import { Phone, Mail, MessageCircle, Star } from 'lucide-react'
import { formatPhone } from '@/lib/utils/providers'
import { CONTACT_TYPE_LABELS } from '@/types/providers'
import { AccordionSection } from '../AccordionSection'
import type { ProviderContact } from '@/types/providers'

// ── Icons per contact type ───────────────────────────────────
const TYPE_ICON = {
  phone:    Phone,
  email:    Mail,
  whatsapp: MessageCircle,
} as const

// ─────────────────────────────────────────────────────────────
// Single contact card
// ─────────────────────────────────────────────────────────────
function ContactCard({ contact }: { contact: ProviderContact }) {
  const Icon = TYPE_ICON[contact.type]

  function getDisplayValue() {
    if (contact.type === 'email') return contact.value
    return formatPhone(contact.value)
  }

  function getTelHref(): string | null {
    if (contact.type === 'phone' || contact.type === 'whatsapp') {
      return `tel:${contact.value.replace(/\D/g, '')}`
    }
    return null
  }

  function getWaUrl(): string | null {
    if (contact.type !== 'whatsapp' && contact.type !== 'phone') return null
    const digits = contact.value.replace(/\D/g, '')
    const withCountry = digits.startsWith('55') ? digits : `55${digits}`
    return `https://wa.me/${withCountry}`
  }

  const telHref = getTelHref()
  const waUrl = getWaUrl()
  const mailHref = contact.type === 'email' ? `mailto:${contact.value}` : null

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{getDisplayValue()}</p>
          {contact.label && (
            <p className="text-xs text-muted-foreground">{contact.label}</p>
          )}
          <p className="text-xs text-muted-foreground/60">{CONTACT_TYPE_LABELS[contact.type]}</p>
        </div>
        {contact.is_primary && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium badge-amber border shrink-0">
            <Star className="w-2.5 h-2.5" />
            Principal
          </span>
        )}
      </div>

      {/* Quick action buttons */}
      <div className="flex gap-2 pl-10">
        {telHref && (
          <a
            href={telHref}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Phone className="w-3 h-3" />
            Ligar
          </a>
        )}
        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <MessageCircle className="w-3 h-3" />
            WhatsApp
          </a>
        )}
        {mailHref && (
          <a
            href={mailHref}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Mail className="w-3 h-3" />
            Enviar e-mail
          </a>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Section
// ─────────────────────────────────────────────────────────────
interface Props {
  contacts: ProviderContact[]
}

export function ContactsSection({ contacts }: Props) {
  if (contacts.length === 0) return null

  // Primary first, then others
  const sorted = [...contacts].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1
    if (!a.is_primary && b.is_primary) return 1
    return 0
  })

  return (
    <AccordionSection title="Contatos" icon={Phone} badge={contacts.length} defaultOpen>
      <div className="space-y-2">
        {sorted.map((c) => (
          <ContactCard key={c.id} contact={c} />
        ))}
      </div>
    </AccordionSection>
  )
}
