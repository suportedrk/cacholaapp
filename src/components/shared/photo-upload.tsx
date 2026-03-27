'use client'

import { useRef, useState } from 'react'
import { Camera, ImagePlus, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Canvas toBlob returned null'))
        },
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

// ─────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────
interface PhotoUploadProps {
  bucket: string
  folder: string
  label?: string
  maxFiles?: number
  existingCount?: number
  disabled?: boolean
  onUploadComplete: (storagePath: string) => Promise<void>
  className?: string
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
export function PhotoUpload({
  bucket,
  folder,
  label = 'Adicionar foto',
  maxFiles = 5,
  existingCount = 0,
  disabled = false,
  onUploadComplete,
  className,
}: PhotoUploadProps) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [preview, setPreview] = useState<string | null>(null)

  const remaining = maxFiles - existingCount
  const isDisabled = disabled || uploading || remaining <= 0

  async function handleFile(file: File | null | undefined) {
    if (!file) return

    // Preview
    const previewUrl = URL.createObjectURL(file)
    setPreview(previewUrl)
    setUploading(true)
    setProgress(10)

    try {
      // Compress
      const blob = await compressImage(file)
      setProgress(40)

      // Upload
      const ext = 'jpg'
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const storagePath = `${folder}/${fileName}`

      const supabase = createClient()
      const { error } = await supabase.storage
        .from(bucket)
        .upload(storagePath, blob, {
          contentType: 'image/jpeg',
          upsert: false,
        })

      if (error) throw error
      setProgress(80)

      await onUploadComplete(storagePath)
      setProgress(100)
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setTimeout(() => {
        setUploading(false)
        setProgress(0)
        setPreview(null)
        URL.revokeObjectURL(previewUrl)
      }, 600)
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Preview + progress during upload */}
      {uploading && preview && (
        <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="preview" className="w-full h-full object-cover opacity-60" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-foreground animate-spin" />
          </div>
          {/* Progress bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isDisabled}
          onClick={() => cameraRef.current?.click()}
          className="gap-1.5"
        >
          <Camera className="w-4 h-4" />
          Câmera
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isDisabled}
          onClick={() => galleryRef.current?.click()}
          className="gap-1.5"
        >
          <ImagePlus className="w-4 h-4" />
          Galeria
        </Button>
        {remaining <= maxFiles && (
          <span className="text-xs text-muted-foreground">
            {existingCount}/{maxFiles}
          </span>
        )}
      </div>

      {/* Hidden inputs */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0])}
        onClick={(e) => ((e.target as HTMLInputElement).value = '')}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0])}
        onClick={(e) => ((e.target as HTMLInputElement).value = '')}
      />

      {label && remaining <= 0 && (
        <p className="text-xs text-muted-foreground">Limite de {maxFiles} fotos atingido.</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// THUMBNAIL (para exibir fotos já salvas)
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
    <div className="relative group w-20 h-20 rounded-lg overflow-hidden border border-border">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover cursor-pointer"
        onClick={onClick}
      />
      {onRemove && (
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className={cn(
            'absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white',
            'flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity',
            'focus-visible:opacity-100'
          )}
          aria-label="Remover foto"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
