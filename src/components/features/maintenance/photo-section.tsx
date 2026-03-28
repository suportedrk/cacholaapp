'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { PhotoDropZone, PhotoThumb } from '@/components/shared/photo-upload'
import { PhotoLightbox } from '@/components/shared/photo-lightbox'
import { useSignedUrls } from '@/hooks/use-signed-urls'
import { useAddMaintenancePhoto, useRemoveMaintenancePhoto } from '@/hooks/use-maintenance'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import type { MaintenancePhoto, PhotoType } from '@/types/database.types'

const BUCKET = 'maintenance-photos'

const PHOTO_LABELS: Record<PhotoType, string> = {
  before: 'Antes',
  during: 'Durante',
  after:  'Depois',
}

// ─────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────
interface PhotoSectionProps {
  orderId: string
  photos: MaintenancePhoto[]
  canEdit?: boolean
}

// ─────────────────────────────────────────────────────────────
// SECTION COLUMN (Antes / Depois)
// ─────────────────────────────────────────────────────────────
interface SectionColumnProps {
  type: PhotoType
  photos: MaintenancePhoto[]
  signedUrls: Record<string, string>
  canEdit: boolean
  orderId: string
  isRemoving: boolean
  onUpload: (path: string, type: PhotoType) => Promise<void>
  onRemove: (photo: MaintenancePhoto) => void
  onLightbox: (photos: MaintenancePhoto[], startId: string) => void
  isPendingAdd: boolean
}

function SectionColumn({
  type,
  photos,
  signedUrls,
  canEdit,
  orderId,
  isRemoving,
  onUpload,
  onRemove,
  onLightbox,
  isPendingAdd,
}: SectionColumnProps) {
  const badgeClass = type === 'before'
    ? 'badge-gray border'
    : type === 'after'
    ? 'badge-green border'
    : 'badge-amber border'

  return (
    <div className="space-y-3">
      {/* Section label */}
      <div className="flex items-center gap-2">
        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', badgeClass)}>
          {PHOTO_LABELS[type]}
        </span>
        {photos.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {photos.length} foto{photos.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Existing photos */}
      <div className="space-y-2">
        {photos.map((photo) => {
          const src = signedUrls[photo.url]
          if (!src) return null
          return (
            <PhotoThumb
              key={photo.id}
              src={src}
              alt={PHOTO_LABELS[type]}
              onClick={() => onLightbox(photos, photo.id)}
              onRemove={canEdit ? () => onRemove(photo) : undefined}
              disabled={isRemoving}
            />
          )
        })}

        {/* Empty state (read-only) */}
        {photos.length === 0 && !canEdit && (
          <div className="aspect-[4/3] rounded-xl bg-muted/50 border border-dashed border-border flex items-center justify-center">
            <p className="text-xs text-muted-foreground">Nenhuma foto</p>
          </div>
        )}
      </div>

      {/* Drop zone */}
      {canEdit && (
        <PhotoDropZone
          bucket={BUCKET}
          folder={`${orderId}/${type}`}
          maxFiles={5}
          existingCount={photos.length}
          disabled={isPendingAdd}
          onUploadComplete={(path) => onUpload(path, type)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export function PhotoSection({ orderId, photos, canEdit = true }: PhotoSectionProps) {
  const { profile }  = useAuth()
  const addPhoto     = useAddMaintenancePhoto()
  const removePhoto  = useRemoveMaintenancePhoto()

  // Lightbox state
  const [lightboxPhotos, setLightboxPhotos] = useState<Array<{ id: string; signedUrl: string; label?: string }>>([])
  const [lightboxOpen, setLightboxOpen]     = useState(false)
  const [lightboxIndex, setLightboxIndex]   = useState(0)

  // Batch-resolve signed URLs for all photos
  const paths = photos.map((p) => p.url)
  const { data: signedUrls = {} } = useSignedUrls(BUCKET, paths)

  async function handleUpload(storagePath: string, type: PhotoType) {
    if (!profile?.id) return
    await addPhoto.mutateAsync({
      orderId,
      url: storagePath,
      type,
      uploadedBy: profile.id,
    })
  }

  async function handleRemove(photo: MaintenancePhoto) {
    try {
      const supabase = createClient()
      await supabase.storage.from(BUCKET).remove([photo.url])
    } catch {
      // non-fatal — proceed to DB deletion
    }
    removePhoto.mutate({ photoId: photo.id, orderId })
  }

  function openLightbox(sectionPhotos: MaintenancePhoto[], startId: string) {
    const resolved = sectionPhotos
      .map((p) => ({ id: p.id, signedUrl: signedUrls[p.url] ?? '', label: PHOTO_LABELS[p.type] }))
      .filter((p) => p.signedUrl)
    const idx = resolved.findIndex((p) => p.id === startId)
    setLightboxPhotos(resolved)
    setLightboxIndex(idx >= 0 ? idx : 0)
    setLightboxOpen(true)
  }

  const beforePhotos = photos.filter((p) => p.type === 'before')
  const afterPhotos  = photos.filter((p) => p.type === 'after')
  const duringPhotos = photos.filter((p) => p.type === 'during')
  const totalCount   = photos.length
  const showDuring   = duringPhotos.length > 0 || canEdit

  const commonProps = {
    signedUrls,
    canEdit,
    orderId,
    isRemoving: removePhoto.isPending,
    onUpload: handleUpload,
    onRemove: handleRemove,
    onLightbox: openLightbox,
    isPendingAdd: addPhoto.isPending,
  }

  return (
    <>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">
            Fotos{totalCount > 0 ? ` (${totalCount})` : ''}
          </h2>
        </div>

        {/* ── Antes / Depois — 2-column grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
          <div className="p-4">
            <SectionColumn type="before" photos={beforePhotos} {...commonProps} />
          </div>
          <div className="p-4">
            <SectionColumn type="after" photos={afterPhotos} {...commonProps} />
          </div>
        </div>

        {/* ── Durante — full width below ── */}
        {showDuring && (
          <div className="border-t border-border p-4">
            <SectionColumn type="during" photos={duringPhotos} {...commonProps} />
          </div>
        )}
      </div>

      <PhotoLightbox
        photos={lightboxPhotos}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        currentIndex={lightboxIndex}
        onIndexChange={setLightboxIndex}
      />
    </>
  )
}
