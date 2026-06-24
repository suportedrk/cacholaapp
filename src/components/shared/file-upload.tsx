'use client'

import { useRef, useState } from 'react'
import { Paperclip, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

export interface UploadedFileMeta {
  storage_path: string
  file_name: string
  mime_type: string
  size_bytes: number
}

interface FileDropZoneProps {
  bucket: string
  folder: string
  accept: string                       // atributo accept do input (ex.: '.pdf,image/*')
  allowedMime: readonly string[]
  maxBytes: number
  disabled?: boolean
  onUploaded: (meta: UploadedFileMeta) => void | Promise<void>
  className?: string
}

/** Extensão a partir do nome do arquivo (fallback 'bin'). */
function extOf(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name)
  return m ? m[1].toLowerCase() : 'bin'
}

/**
 * Uploader genérico de arquivos (PDF/imagem) para um bucket privado do Supabase.
 * Sem compressão (ao contrário do PhotoDropZone, que é só imagem → JPEG).
 * Sobe cada arquivo selecionado e chama onUploaded com a metadata.
 */
export function FileDropZone({
  bucket,
  folder,
  accept,
  allowedMime,
  maxBytes,
  disabled,
  onUploaded,
  className,
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)

  async function uploadOne(file: File) {
    if (!allowedMime.includes(file.type)) {
      toast.error(`"${file.name}": tipo não permitido (use PDF, JPG, PNG ou WebP).`)
      return
    }
    if (file.size > maxBytes) {
      toast.error(`"${file.name}": excede o limite de ${Math.round(maxBytes / 1024 / 1024)} MB.`)
      return
    }

    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extOf(file.name)}`
    const storagePath = `${folder}/${fileName}`
      .replace(/^\/+/, '')
      .replace(new RegExp(`^${bucket}/`, 'i'), '')

    const supabase = createClient()
    const { error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, file, { contentType: file.type, upsert: false })

    if (error) {
      toast.error(`Falha ao enviar "${file.name}".`)
      console.error('[FileDropZone] upload error:', error)
      return
    }

    await onUploaded({
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
    })
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      // Sequencial: mantém ordem e evita rajada de requests.
      for (const file of Array.from(files)) {
        await uploadOne(file)
      }
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    if (disabled || uploading) return
    void handleFiles(e.dataTransfer.files)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    void handleFiles(e.target.files)
    e.target.value = ''
  }

  const isDisabled = disabled || uploading

  return (
    <div className={className}>
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!isDisabled) setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          'w-full rounded-xl border-2 border-dashed transition-all duration-200',
          'flex flex-col items-center justify-center gap-2 py-5 px-3 min-h-[44px]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isDragOver
            ? 'border-primary bg-[var(--color-brand-50)] dark:bg-[oklch(0.260_0.040_144_/_0.15)]'
            : 'border-border hover:border-primary hover:bg-[var(--color-brand-50)] dark:hover:bg-[oklch(0.260_0.040_144_/_0.08)]',
          isDisabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        )}
      >
        {uploading ? (
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
        ) : (
          <Paperclip className={cn('w-7 h-7 transition-colors', isDragOver ? 'text-primary' : 'text-muted-foreground')} />
        )}
        <div className="text-center space-y-0.5">
          <p className={cn('text-sm font-medium transition-colors', isDragOver ? 'text-primary' : 'text-muted-foreground')}>
            {uploading ? 'Enviando…' : (
              <>
                <span className="sm:hidden">Toque para anexar arquivo</span>
                <span className="hidden sm:inline">Arraste arquivos ou clique para anexar</span>
              </>
            )}
          </p>
          <p className="text-xs text-muted-foreground/60">
            PDF, JPG, PNG, WebP — máx. {Math.round(maxBytes / 1024 / 1024)} MB por arquivo
          </p>
        </div>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="sr-only"
        onChange={handleChange}
      />
    </div>
  )
}
