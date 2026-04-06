'use client'

import { useState, useRef } from 'react'
import { Upload, FileText, X, AlertCircle, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDocumentExpiryStatus } from '@/lib/utils/providers'
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select'
import { DOC_TYPE_LABELS } from '@/types/providers'
import type { DocType } from '@/types/providers'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface DocDraft {
  file: File
  name: string
  doc_type: DocType
  expires_at: string  // ISO date string or ''
}

interface DropZoneProps {
  onFileSelected: (file: File) => void
}

interface DocDraftCardProps {
  draft: DocDraft
  index: number
  onUpdate: (idx: number, data: Partial<DocDraft>) => void
  onRemove: (idx: number) => void
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const MAX_SIZE_MB = 20

// ─────────────────────────────────────────────────────────────
// DropZone
// ─────────────────────────────────────────────────────────────

export function DocumentDropZone({ onFileSelected }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    setError(null)
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Tipo de arquivo não suportado. Use PDF, imagens ou Word.')
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Arquivo muito grande. Máximo ${MAX_SIZE_MB}MB.`)
      return
    }
    onFileSelected(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          'rounded-xl border-2 border-dashed p-8 flex flex-col items-center gap-3 transition-colors cursor-pointer',
          isDragOver
            ? 'border-primary bg-brand-50 dark:bg-primary/10'
            : 'border-border hover:border-primary/50 hover:bg-muted/30',
        )}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Área para upload de documentos"
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        <div className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center transition-colors',
          isDragOver ? 'bg-primary/20' : 'bg-muted',
        )}>
          <Upload className={cn('w-5 h-5', isDragOver ? 'text-primary' : 'text-muted-foreground')} />
        </div>

        <div className="text-center">
          <p className="text-sm text-foreground">
            Arraste arquivos aqui ou{' '}
            <span className="text-primary hover:underline font-medium">selecionar arquivo</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, imagens, Word • Máx {MAX_SIZE_MB}MB
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={handleChange}
          className="hidden"
          aria-hidden="true"
        />
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// DocDraftCard — shows a pending file with metadata form
// ─────────────────────────────────────────────────────────────

export function DocDraftCard({ draft, index, onUpdate, onRemove }: DocDraftCardProps) {
  const [errors, setErrors] = useState<{ name?: string; doc_type?: string }>({})

  function handleNameBlur() {
    if (!draft.name.trim()) {
      setErrors((p) => ({ ...p, name: 'Informe o nome do documento.' }))
    }
  }

  const inputBase = cn(
    'w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground',
    'placeholder:text-muted-foreground/60 outline-none',
    'focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors',
  )

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      {/* File info header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{draft.file.name}</p>
          <p className="text-xs text-muted-foreground">{formatBytes(draft.file.size)}</p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          aria-label="Remover arquivo"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Metadata fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Nome */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-foreground">
            Nome do documento <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => {
              onUpdate(index, { name: e.target.value })
              setErrors((p) => ({ ...p, name: undefined }))
            }}
            onBlur={handleNameBlur}
            placeholder="Ex: Contrato de Serviço"
            aria-invalid={!!errors.name}
            className={cn(inputBase, errors.name && 'border-destructive')}
          />
          {errors.name && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="w-3 h-3 shrink-0" />
              {errors.name}
            </p>
          )}
        </div>

        {/* Tipo */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-foreground">
            Tipo <span className="text-destructive">*</span>
          </label>
          <Select
            value={draft.doc_type}
            onValueChange={(v) => v && onUpdate(index, { doc_type: v as DocType })}
          >
            <SelectTrigger size="sm" className="w-full">
              <span data-slot="select-value" className="flex flex-1 text-left">
                {DOC_TYPE_LABELS[draft.doc_type]}
              </span>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(DOC_TYPE_LABELS) as DocType[]).map((t) => (
                <SelectItem key={t} value={t}>{DOC_TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Vencimento */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-foreground">
          Data de Vencimento
          <span className="text-xs text-muted-foreground font-normal ml-1">(opcional)</span>
        </label>
        <div className="relative w-full sm:w-48">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="date"
            value={draft.expires_at}
            onChange={(e) => onUpdate(index, { expires_at: e.target.value })}
            min={new Date().toISOString().split('T')[0]}
            className={cn(inputBase, 'pl-9')}
          />
        </div>
        {draft.expires_at && (() => {
          const info = getDocumentExpiryStatus(draft.expires_at)
          if (info.status === 'expiring_soon') {
            return (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                ⚠️ Vence em {info.daysRemaining} dias
              </p>
            )
          }
          return null
        })()}
      </div>
    </div>
  )
}
