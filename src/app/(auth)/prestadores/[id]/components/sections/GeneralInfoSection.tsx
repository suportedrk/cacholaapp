'use client'

import { FileText, ExternalLink } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AccordionSection } from '../AccordionSection'
import { formatCPF, formatCNPJ } from '@/lib/utils/providers'
import { PROVIDER_STATUS_LABELS } from '@/types/providers'
import type { ServiceProviderWithDetails } from '@/types/providers'

// ─────────────────────────────────────────────────────────────
// Info row helper
// ─────────────────────────────────────────────────────────────
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  )
}

interface Props {
  provider: ServiceProviderWithDetails
}

export function GeneralInfoSection({ provider }: Props) {
  const formattedDoc = provider.document_type === 'cnpj'
    ? formatCNPJ(provider.document_number)
    : formatCPF(provider.document_number)

  const address = [
    provider.address,
    provider.city && provider.state ? `${provider.city}, ${provider.state}` : (provider.city ?? provider.state),
    provider.zip_code,
  ].filter(Boolean).join(' — ')

  const createdAt = provider.created_at
    ? format(parseISO(provider.created_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
    : null

  return (
    <AccordionSection title="Dados Gerais" icon={FileText} defaultOpen>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        <InfoRow label="Nome Fantasia">{provider.name}</InfoRow>

        {provider.legal_name && provider.legal_name !== provider.name && (
          <InfoRow label="Razão Social">{provider.legal_name}</InfoRow>
        )}

        <InfoRow label={provider.document_type === 'cnpj' ? 'CNPJ' : 'CPF'}>
          <span className="font-mono">{formattedDoc}</span>
        </InfoRow>

        <InfoRow label="Status">
          <span>{PROVIDER_STATUS_LABELS[provider.status]}</span>
        </InfoRow>

        {provider.instagram && (
          <InfoRow label="Instagram">
            <a
              href={`https://instagram.com/${provider.instagram.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-text-link hover:underline"
            >
              {provider.instagram}
              <ExternalLink className="w-3 h-3" />
            </a>
          </InfoRow>
        )}

        {provider.website && (
          <InfoRow label="Website">
            <a
              href={provider.website.startsWith('http') ? provider.website : `https://${provider.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-text-link hover:underline truncate max-w-[200px]"
            >
              {provider.website}
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          </InfoRow>
        )}

        {address && (
          <InfoRow label="Endereço">
            <span className="break-words">{address}</span>
          </InfoRow>
        )}

        {createdAt && (
          <InfoRow label="Cadastrado em">{createdAt}</InfoRow>
        )}
      </div>
    </AccordionSection>
  )
}
