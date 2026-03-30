'use client'

import { useState } from 'react'
import { Paperclip, FileText, Eye, Download, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDocumentExpiryStatus } from '@/lib/utils/providers'
import { DOC_TYPE_LABELS } from '@/types/providers'
import { AccordionSection } from '../AccordionSection'
import { createClient } from '@/lib/supabase/client'
import type { ProviderDocument } from '@/types/providers'

// ── Expiry badge styles ──────────────────────────────────────
const EXPIRY_BADGE: Record<string, string> = {
  valid:         'badge-green border',
  expiring_soon: 'badge-amber border',
  expired:       'badge-red border',
  no_expiry:     'badge-gray border',
}

const EXPIRY_LABEL: Record<string, (days: number | null, date: string | null) => string> = {
  valid:         (d) => `Válido · ${d} dias restantes`,
  expiring_soon: (d) => `Vence em ${d} dias`,
  expired:       (d) => `Vencido há ${Math.abs(d ?? 0)} dias`,
  no_expiry:     () => 'Sem vencimento',
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─────────────────────────────────────────────────────────────
// Document card
// ─────────────────────────────────────────────────────────────
function DocumentCard({ doc }: { doc: ProviderDocument }) {
  const [loading, setLoading] = useState(false)
  const expiry = getDocumentExpiryStatus(doc.expires_at)
  const badgeClass = EXPIRY_BADGE[expiry.status]
  const badgeLabel = EXPIRY_LABEL[expiry.status](expiry.daysRemaining, doc.expires_at)

  async function getSignedUrl(): Promise<string | null> {
    const supabase = createClient()
    const { data } = await supabase.storage
      .from('provider-documents')
      .createSignedUrl(doc.file_url, 3600)
    return data?.signedUrl ?? null
  }

  async function handleView() {
    setLoading(true)
    try {
      const url = await getSignedUrl()
      if (url) window.open(url, '_blank', 'noopener noreferrer')
    } finally {
      setLoading(false)
    }
  }

  async function handleDownload() {
    setLoading(true)
    try {
      const url = await getSignedUrl()
      if (!url) return
      const a = document.createElement('a')
      a.href = url
      a.download = doc.file_name
      a.click()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
            <span className="text-xs text-muted-foreground">
              {DOC_TYPE_LABELS[doc.doc_type]}
            </span>
            {doc.file_size && (
              <>
                <span className="text-muted-foreground/40 text-xs">·</span>
                <span className="text-xs text-muted-foreground">{formatBytes(doc.file_size)}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleView}
            disabled={loading}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            aria-label="Visualizar"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={loading}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            aria-label="Baixar"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expiry badge */}
      <div className="pl-12">
        <span className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
          badgeClass,
        )}>
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
          {badgeLabel}
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Section
// ─────────────────────────────────────────────────────────────
interface Props {
  documents: ProviderDocument[]
}

export function DocumentsSection({ documents }: Props) {
  if (documents.length === 0) return null

  const expiringCount = documents.filter((d) => {
    const s = getDocumentExpiryStatus(d.expires_at)
    return s.status === 'expiring_soon' || s.status === 'expired'
  }).length

  const badge = expiringCount > 0
    ? `${documents.length} · ⚠️ ${expiringCount} vencendo`
    : documents.length

  // Auto-open if any doc is expiring/expired
  const hasUrgent = expiringCount > 0

  return (
    <AccordionSection
      title="Documentos"
      icon={Paperclip}
      badge={badge}
      defaultOpen={hasUrgent}
    >
      {expiringCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {expiringCount} {expiringCount === 1 ? 'documento vencendo' : 'documentos vencendo'} — verifique as datas de validade.
          </p>
        </div>
      )}
      <div className="space-y-2">
        {documents.map((doc) => (
          <DocumentCard key={doc.id} doc={doc} />
        ))}
      </div>
    </AccordionSection>
  )
}
