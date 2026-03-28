'use client'

import { useRef, useState } from 'react'
import { Camera, CheckCircle2, ImagePlus, RefreshCw, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

// ─────────────────────────────────────────────────────────────
// CANVAS COMPRESSION
// ─────────────────────────────────────────────────────────────
export async function compressImage(file: File, maxDimension = 1200, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const { width, height } = img
      let newWidth = width
      let newHeight = height

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          newWidth = maxDimension
          newHeight = Math.round((height * maxDimension) / width)
        } else {
          newHeight = maxDimension
          newWidth = Math.round((width * maxDimension) / height)
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = newWidth
      canvas.height = newHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas context unavailable'))
      ctx.drawImage(img, 0, 0, newWidth, newHeight)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob returned null'))),
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image'))
    }
    img.src = objectUrl
  })
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ─────────────────────────────────────────────────────────────
// PHOTO DROP ZONE
// ─────────────────────────────────────────────────────────────
interface PhotoDropZoneProps {
  bucket: string
  folder: string
  maxFiles?: number
  existingCount?: number
  disabled?: boolean
  onUploadComplete: (storagePath: string) => Promise<void>
  className?: string
}

type UploadStatus = 'idle' | 'confirm' | 'uploading' | 'success' | 'error'

export function PhotoDropZone({
  bucket,
  folder,
  maxFiles = 5,
  existingCount = 0,
  disabled,
  onUploadComplete,
  className,
}: PhotoDropZoneProps) {
  const cameraRef  = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const [isDragOver, setIsDragOver]         = useState(false)
  const [status, setStatus]                 = useState<UploadStatus>('idle')
  const [progress, setProgress]             = useState(0)
  const [preview, setPreview]               = useState<string | null>(null)
  const [originalSize, setOriginalSize]     = useState(0)
  const [compressedSize, setCompressedSize] = useState(0)
  const [errorMsg, setErrorMsg]             = useState<string | null>(null)

  const selectedFileRef = useRef<File | null>(null)
  const previewUrlRef   = useRef<string | null>(null)
  const progressTimer   = useRef<ReturnType<typeof setInterval> | null>(null)

  const remaining  = maxFiles - existingCount
  const isDisabled = disabled || remaining <= 0

  function clearPreview() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setPreview(null)
  }

  function stopTimer() {
    if (progressTimer.current) {
      clearInterval(progressTimer.current)
      progressTimer.current = null
    }
  }

  function handleFileSelected(file: File) {
    selectedFileRef.current = file
    setOriginalSize(file.size)
    setCompressedSize(0)
    setErrorMsg(null)
    stopTimer()

    const url = URL.createObjectURL(file)
    previewUrlRef.current = url
    setPreview(url)
    setStatus('confirm')
  }

  async function startUpload() {
    const file = selectedFileRef.current
    if (!file) return

    setStatus('uploading')
    setProgress(15)

    try {
      const blob = await compressImage(file)
      setCompressedSize(blob.size)
      setProgress(45)

      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
      const storagePath = `${folder}/${fileName}`

      progressTimer.current = setInterval(
        () => setProgress((p) => Math.min(p + 4, 88)),
        150
      )

      const supabase = createClient()
      const { error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: false })

      stopTimer()
      if (uploadErr) throw uploadErr

      setProgress(100)
      await onUploadComplete(storagePath)
      setStatus('success')

      setTimeout(() => {
        setStatus('idle')
        setProgress(0)
        clearPreview()
      }, 1300)
    } catch (err) {
      stopTimer()
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao enviar foto')
      setStatus('error')
    }
  }

  function retakePhoto() {
    clearPreview()
    selectedFileRef.current = null
    setStatus('idle')
    setTimeout(() => cameraRef.current?.click(), 60)
  }

  function cancelConfirm() {
    clearPreview()
    selectedFileRef.current = null
    setStatus('idle')
  }

  function retry() {
    if (selectedFileRef.current) {
      const url = URL.createObjectURL(selectedFileRef.current)
      previewUrlRef.current = url
      setPreview(url)
      setProgress(0)
      setErrorMsg(null)
      setStatus('confirm')
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith('image/')) handleFileSelected(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFileSelected(file)
    e.target.value = ''
  }

  if (remaining <= 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-2">
        Limite de {maxFiles} fotos atingido
      </p>
    )
  }

  return (
    <div className={cn('space-y-1.5', className)}>

      {/* ── Confirm: preview + Usar foto / Tirar outra ── */}
      {status === 'confirm' && preview && (
        <div className="space-y-2">
          <div className="relative rounded-xl overflow-hidden aspect-[4/3] bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="preview" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={cancelConfirm}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
              aria-label="Cancelar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={retakePhoto}
              className="h-9 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              Tirar outra
            </button>
            <button
              type="button"
              onClick={startUpload}
              className="h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Usar foto
            </button>
          </div>
        </div>
      )}

      {/* ── Uploading: progress overlay ── */}
      {status === 'uploading' && preview && (
        <div className="relative rounded-xl overflow-hidden aspect-[4/3] bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="preview" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-1">
            <span className="text-white font-semibold text-2xl tabular-nums">{progress}%</span>
            <span className="text-white/70 text-xs">Enviando…</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/30">
            <div
              className="h-full bg-primary transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          {compressedSize > 0 && (
            <div className="absolute top-2 left-2 bg-black/55 rounded-md text-xs text-white/90 px-2 py-0.5 font-medium tabular-nums">
              {formatSize(originalSize)} → {formatSize(compressedSize)}
            </div>
          )}
        </div>
      )}

      {/* ── Success: green check ── */}
      {status === 'success' && preview && (
        <div className="relative rounded-xl overflow-hidden aspect-[4/3] bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="preview" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center animate-scale-in">
            <CheckCircle2 className="w-12 h-12 text-green-400 drop-shadow-lg" />
          </div>
          {compressedSize > 0 && (
            <div className="absolute top-2 left-2 bg-black/55 rounded-md text-xs text-white/90 px-2 py-0.5 font-medium tabular-nums">
              {formatSize(originalSize)} → {formatSize(compressedSize)}
            </div>
          )}
        </div>
      )}

      {/* ── Error: red X + retry ── */}
      {status === 'error' && (
        <div className="relative rounded-xl overflow-hidden aspect-[4/3] bg-muted">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="preview" className="w-full h-full object-cover opacity-30" />
          )}
          <div className="absolute inset-0 bg-black/65 flex flex-col items-center justify-center gap-2 p-3">
            <X className="w-8 h-8 text-red-400" />
            <p className="text-xs text-white/90 text-center leading-snug">{errorMsg}</p>
            <button
              type="button"
              onClick={retry}
              className="flex items-center gap-1.5 text-xs text-white bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5 transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Tentar novamente
            </button>
          </div>
        </div>
      )}

      {/* ── Drop zone (idle state) ── */}
      {status === 'idle' && (
        <>
          <button
            type="button"
            disabled={isDisabled}
            onClick={() => cameraRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              'w-full rounded-xl border-2 border-dashed transition-all duration-200',
              'flex flex-col items-center justify-center gap-2 py-5 px-3',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isDragOver
                ? 'border-primary bg-[var(--color-brand-50)] dark:bg-[oklch(0.260_0.040_144_/_0.15)]'
                : [
                    'border-border',
                    'hover:border-primary',
                    'hover:bg-[var(--color-brand-50)]',
                    'dark:hover:bg-[oklch(0.260_0.040_144_/_0.08)]',
                  ],
              isDisabled && 'opacity-50 cursor-not-allowed pointer-events-none'
            )}
          >
            <Camera
              className={cn(
                'w-8 h-8 transition-colors',
                isDragOver ? 'text-primary' : 'text-muted-foreground'
              )}
            />
            <div className="text-center space-y-0.5">
              <p className={cn(
                'text-sm font-medium transition-colors',
                isDragOver ? 'text-primary' : 'text-muted-foreground'
              )}>
                <span className="sm:hidden">Toque para tirar foto</span>
                <span className="hidden sm:inline">Arraste fotos ou clique para selecionar</span>
              </p>
              <p className="text-xs text-muted-foreground/60">JPEG, PNG — máx. 10 MB por foto</p>
            </div>
          </button>

          {/* Secondary: gallery link */}
          <button
            type="button"
            disabled={isDisabled}
            onClick={() => galleryRef.current?.click()}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5 disabled:pointer-events-none disabled:opacity-50"
          >
            <ImagePlus className="w-3.5 h-3.5" />
            ou escolher da galeria
          </button>
        </>
      )}

      {/* Hidden inputs */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handleChange}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleChange}
      />
    </div>
  )
}

// Backward compat alias
export { PhotoDropZone as PhotoUpload }

// ─────────────────────────────────────────────────────────────
// PHOTO THUMBNAIL (existing photos)
// ─────────────────────────────────────────────────────────────
interface PhotoThumbProps {
  src: string
  alt?: string
  onRemove?: () => void
  onClick?: () => void
  disabled?: boolean
}

export function PhotoThumb({ src, alt = 'foto', onRemove, onClick, disabled }: PhotoThumbProps) {
  return (
    <div
      className={cn(
        'relative rounded-xl overflow-hidden aspect-[4/3] bg-muted group',
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
      />

      {/* Subtle hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />

      {/* Remove — always visible on mobile, hover on desktop */}
      {onRemove && (
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className={cn(
            'absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white',
            'flex items-center justify-center transition-colors hover:bg-red-500',
            'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100',
            disabled && 'cursor-not-allowed opacity-30'
          )}
          aria-label="Remover foto"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
