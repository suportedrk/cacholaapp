'use client'

import { useState, useRef } from 'react'
import { format, differenceInDays, isPast, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  FileText, Image, File, Upload, Trash2,
  Eye, AlertTriangle, Plus, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { PhotoLightbox } from '@/components/shared/photo-lightbox'
import { useSignedUrls } from '@/hooks/use-signed-urls'
import {
  useUploadSupplierDocument,
  useDeleteSupplierDocument,
} from '@/hooks/use-suppliers'
import { cn } from '@/lib/utils'
import type { SupplierDocument } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────
function formatBytes(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(fileType: string | null) {
  if (!fileType) return File
  if (fileType.startsWith('image/')) return Image
  if (fileType === 'application/pdf') return FileText
  return File
}

function expiryBadge(expiresAt: string | null) {
  if (!expiresAt) return null
  const date = parseISO(expiresAt)
  if (isPast(date)) {
    return { label: 'Vencido', class: 'badge-red border' }
  }
  const days = differenceInDays(date, new Date())
  if (days <= 30) {
    return { label: `Vence em ${days}d`, class: 'badge-amber border' }
  }
  return null
}

// ─────────────────────────────────────────────────────────────
// UPLOAD FORM (inline)
// ─────────────────────────────────────────────────────────────
interface UploadFormProps {
  supplierId: string
  onDone:     () => void
}

function UploadForm({ supplierId, onDone }: UploadFormProps) {
  const uploadDoc = useUploadSupplierDocument()
  const fileRef   = useRef<HTMLInputElement>(null)

  const [docName,    setDocName]    = useState('')
  const [expiresAt,  setExpiresAt]  = useState('')
  const [file,       setFile]       = useState<File | null>(null)
  const [progress,   setProgress]   = useState(0)
  const [nameError,  setNameError]  = useState('')
  const [fileError,  setFileError]  = useState('')

  const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFileError('')
    if (f && f.size > MAX_BYTES) {
      setFileError('Arquivo deve ter no máximo 10 MB')
      e.target.value = ''
      return
    }
    setFile(f)
    if (f && !docName) setDocName(f.name.replace(/\.[^.]+$/, ''))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    let hasError = false
    if (!docName.trim()) { setNameError('Nome é obrigatório'); hasError = true }
    if (!file)           { setFileError('Selecione um arquivo'); hasError = true }
    if (hasError) return

    setProgress(0)
    await uploadDoc.mutateAsync({
      supplierId,
      file:         file!,
      documentName: docName.trim(),
      expiresAt:    expiresAt || undefined,
      onProgress:   setProgress,
    })
    onDone()
  }

  const isUploading = uploadDoc.isPending

  return (
    <form onSubmit={handleSubmit} className="bg-muted/30 border border-border rounded-lg p-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Nome do documento */}
        <div className="space-y-1">
          <Label htmlFor="doc_name">
            Nome do documento <span className="text-destructive">*</span>
          </Label>
          <Input
            id="doc_name"
            value={docName}
            onChange={(e) => { setDocName(e.target.value); setNameError('') }}
            placeholder='Ex: "Contrato 2026", "Alvará"'
            className={cn('h-9', nameError && 'border-destructive')}
          />
          {nameError && <p className="text-xs text-destructive">{nameError}</p>}
        </div>

        {/* Data de vencimento */}
        <div className="space-y-1">
          <Label htmlFor="doc_expires">Vencimento (opcional)</Label>
          <Input
            id="doc_expires"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="h-9"
          />
        </div>
      </div>

      {/* Arquivo */}
      <div className="space-y-1">
        <Label>Arquivo <span className="text-destructive">*</span></Label>
        <div
          className={cn(
            'border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer transition-colors',
            'hover:border-primary/50 hover:bg-primary/[0.02]',
            fileError && 'border-destructive',
          )}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={handleFileChange}
            className="hidden"
          />
          {file ? (
            <div className="flex items-center justify-center gap-2">
              {(() => { const Icon = getFileIcon(file.type); return <Icon className="w-5 h-5 text-primary" /> })()}
              <span className="text-sm text-foreground font-medium">{file.name}</span>
              <span className="text-xs text-muted-foreground">({formatBytes(file.size)})</span>
            </div>
          ) : (
            <div className="space-y-1">
              <Upload className="w-6 h-6 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                <span className="sm:hidden">Toque para selecionar</span>
                <span className="hidden sm:inline">Clique ou arraste o arquivo</span>
              </p>
              <p className="text-xs text-muted-foreground">PDF, imagem, DOC — máx. 10 MB</p>
            </div>
          )}
        </div>
        {fileError && <p className="text-xs text-destructive">{fileError}</p>}
      </div>

      {/* Progress bar */}
      {isUploading && progress > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Enviando...</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onDone} disabled={isUploading}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={isUploading}>
          {isUploading
            ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Enviando...</>
            : <><Upload className="w-3.5 h-3.5 mr-1.5" />Enviar</>
          }
        </Button>
      </div>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────
// DOCUMENT ROW
// ─────────────────────────────────────────────────────────────
interface DocRowProps {
  doc:       SupplierDocument
  signedUrl: string | undefined
}

function DocRow({ doc, signedUrl }: DocRowProps) {
  const deleteDoc    = useDeleteSupplierDocument()
  const [lightbox, setLightbox] = useState(false)
  const Icon   = getFileIcon(doc.file_type)
  const badge  = expiryBadge(doc.expires_at)
  const isImage = doc.file_type?.startsWith('image/')

  function handleView() {
    if (!signedUrl) return
    if (isImage) { setLightbox(true); return }
    window.open(signedUrl, '_blank', 'noopener')
  }

  return (
    <>
      <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card group/doc">
        <Icon className="w-5 h-5 text-muted-foreground shrink-0" />

        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">{doc.name}</span>
            {badge && (
              <span className={cn(
                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium',
                badge.class,
              )}>
                <AlertTriangle className="w-2.5 h-2.5" />
                {badge.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {doc.file_size_bytes != null && (
              <span>{formatBytes(doc.file_size_bytes)}</span>
            )}
            {doc.expires_at && (
              <span>
                Vence: {format(parseISO(doc.expires_at), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {signedUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleView}
              className="h-7 w-7 p-0"
              aria-label="Visualizar documento"
            >
              <Eye className="w-3.5 h-3.5" />
            </Button>
          )}
          <ConfirmDialog
            title="Remover documento"
            description={`Tem certeza que deseja remover "${doc.name}"?`}
            destructive
            onConfirm={() => deleteDoc.mutate({
              docId:      doc.id,
              supplierId: doc.supplier_id,
              filePath:   doc.file_url,
            })}
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                aria-label="Remover documento"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            }
          />
        </div>
      </div>

      {/* Image lightbox */}
      {isImage && signedUrl && (
        <PhotoLightbox
          open={lightbox}
          onClose={() => setLightbox(false)}
          photos={[{ id: doc.id, signedUrl, label: doc.name }]}
          currentIndex={0}
          onIndexChange={() => null}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN SECTION
// ─────────────────────────────────────────────────────────────
interface SupplierDocumentSectionProps {
  supplierId: string
  documents:  SupplierDocument[]
}

export function SupplierDocumentSection({ supplierId, documents }: SupplierDocumentSectionProps) {
  const [uploading, setUploading] = useState(false)

  const filePaths = documents.map((d) => d.file_url)
  const { data: signedUrls = {} } = useSignedUrls('supplier-documents', filePaths)

  return (
    <div className="space-y-3">
      {/* Document list */}
      {documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((doc) => (
            <DocRow
              key={doc.id}
              doc={doc}
              signedUrl={signedUrls[doc.file_url]}
            />
          ))}
        </div>
      )}

      {/* Upload form */}
      {uploading ? (
        <UploadForm
          supplierId={supplierId}
          onDone={() => setUploading(false)}
        />
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setUploading(true)}
          className="gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Enviar Documento
        </Button>
      )}

      {documents.length === 0 && !uploading && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum documento cadastrado. Envie contratos, alvarás ou certificados.
        </p>
      )}
    </div>
  )
}
