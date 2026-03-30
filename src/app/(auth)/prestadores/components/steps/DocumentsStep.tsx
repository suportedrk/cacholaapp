'use client'

import { FileText, Trash2, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDocumentExpiryStatus } from '@/lib/utils/providers'
import { DOC_TYPE_LABELS } from '@/types/providers'
import { DocumentDropZone, DocDraftCard } from '../DocumentUploadCard'
import type { DocDraft } from '../DocumentUploadCard'
import type { ProviderDocument } from '@/types/providers'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface Props {
  savedDocuments: ProviderDocument[]
  pendingDocs: DocDraft[]
  errors: Record<string, string>
  onAddDoc: (draft: DocDraft) => void
  onUpdateDoc: (index: number, data: Partial<DocDraft>) => void
  onRemoveDoc: (index: number) => void
  onDeleteSaved?: (id: string) => void
  // Optional: for edit mode immediate upload
  onViewSaved?: (doc: ProviderDocument) => void
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const EXPIRY_BADGE: Record<string, string> = {
  valid:         'badge-green border',
  expiring_soon: 'badge-amber border',
  expired:       'badge-red border',
  no_expiry:     'badge-gray border',
}

const EXPIRY_LABEL: Record<string, (days: number | null) => string> = {
  valid:         (d) => `Válido · ${d} dias`,
  expiring_soon: (d) => `Vence em ${d} dias`,
  expired:       (d) => `Vencido há ${Math.abs(d ?? 0)} dias`,
  no_expiry:     () => 'Sem vencimento',
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function DocumentsStep({
  savedDocuments,
  pendingDocs,
  errors,
  onAddDoc,
  onUpdateDoc,
  onRemoveDoc,
  onDeleteSaved,
  onViewSaved,
}: Props) {
  function handleFileSelected(file: File) {
    const draft: DocDraft = {
      file,
      name: file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
      doc_type: 'other',
      expires_at: '',
    }
    onAddDoc(draft)
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Documentos e Anexos</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Anexe contratos, alvarás, certificados e outros documentos. Esta etapa é opcional.
        </p>
      </div>

      {/* Saved documents */}
      {savedDocuments.map((doc) => {
        const expiry = getDocumentExpiryStatus(doc.expires_at)
        const badgeClass = EXPIRY_BADGE[expiry.status]
        const badgeLabel = EXPIRY_LABEL[expiry.status](expiry.daysRemaining)

        return (
          <div key={doc.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
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
                {onViewSaved && (
                  <button
                    type="button"
                    onClick={() => onViewSaved(doc)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    aria-label="Visualizar documento"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                )}
                {onDeleteSaved && (
                  <button
                    type="button"
                    onClick={() => onDeleteSaved(doc.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    aria-label="Remover documento"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
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
      })}

      {/* Pending docs */}
      {pendingDocs.map((draft, idx) => (
        <DocDraftCard
          key={idx}
          draft={draft}
          index={idx}
          onUpdate={onUpdateDoc}
          onRemove={onRemoveDoc}
        />
      ))}

      {/* Drop zone */}
      <DocumentDropZone onFileSelected={handleFileSelected} />

      {/* Summary */}
      {(savedDocuments.length + pendingDocs.length) > 0 && (
        <p className="text-xs text-muted-foreground">
          {savedDocuments.length + pendingDocs.length}{' '}
          {savedDocuments.length + pendingDocs.length === 1 ? 'documento' : 'documentos'} adicionado{savedDocuments.length + pendingDocs.length > 1 ? 's' : ''}
        </p>
      )}

      {errors.documents && (
        <p className="text-xs text-destructive">{errors.documents}</p>
      )}
    </div>
  )
}
