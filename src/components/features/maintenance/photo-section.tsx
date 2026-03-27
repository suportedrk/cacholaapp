'use client'

import { useState } from 'react'
import { Separator } from '@/components/ui/separator'
import { PhotoUpload, PhotoThumb } from '@/components/shared/photo-upload'
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

const SECTIONS: PhotoType[] = ['before', 'during', 'after']

// ─────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────
interface PhotoSectionProps {
  orderId: string
  photos: MaintenancePhoto[]
  canEdit?: boolean
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
export function PhotoSection({ orderId, photos, canEdit = true }: PhotoSectionProps) {
  const { profile } = useAuth()
  const addPhoto = useAddMaintenancePhoto()
  const removePhoto = useRemoveMaintenancePhoto()

  // Lightbox state
  const [lightboxPhotos, setLightboxPhotos] = useState<Array<{ id: string; signedUrl: string; label?: string }>>([])
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  // Gather all storage paths to batch-resolve signed URLs
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
    // Remove from storage first
    try {
      const supabase = createClient()
      await supabase.storage.from(BUCKET).remove([photo.url])
    } catch {
      // Non-fatal — proceed to DB deletion
    }
    removePhoto.mutate({ photoId: photo.id, orderId })
  }

  function openLightbox(photos: MaintenancePhoto[], startId: string) {
    const resolved = photos
      .map((p) => ({ id: p.id, signedUrl: signedUrls[p.url] ?? '', label: PHOTO_LABELS[p.type] }))
      .filter((p) => p.signedUrl)
    const idx = resolved.findIndex((p) => p.id === startId)
    setLightboxPhotos(resolved)
    setLightboxIndex(idx >= 0 ? idx : 0)
    setLightboxOpen(true)
  }

  const totalCount = photos.length
  const hasPhotos = totalCount > 0

  return (
    <>
      <div className="bg-card rounded-xl border border-border p-4 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">
          Fotos{hasPhotos ? ` (${totalCount})` : ''}
        </h2>
        <Separator />

        {SECTIONS.map((type) => {
          const sectionPhotos = photos.filter((p) => p.type === type)
          const folder = `${orderId}/${type}`

          return (
            <div key={type} className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {PHOTO_LABELS[type]}
              </h3>

              <div className="flex flex-wrap gap-2">
                {/* Existing photos */}
                {sectionPhotos.map((photo) => {
                  const src = signedUrls[photo.url]
                  if (!src) return null
                  return (
                    <PhotoThumb
                      key={photo.id}
                      src={src}
                      alt={PHOTO_LABELS[type]}
                      onClick={() => openLightbox(sectionPhotos, photo.id)}
                      onRemove={canEdit ? () => handleRemove(photo) : undefined}
                      disabled={removePhoto.isPending}
                    />
                  )
                })}

                {/* Upload button */}
                {canEdit && (
                  <PhotoUpload
                    bucket={BUCKET}
                    folder={folder}
                    label={PHOTO_LABELS[type]}
                    maxFiles={5}
                    existingCount={sectionPhotos.length}
                    disabled={addPhoto.isPending}
                    onUploadComplete={(path) => handleUpload(path, type)}
                  />
                )}
              </div>

              {/* Empty state */}
              {sectionPhotos.length === 0 && !canEdit && (
                <p className="text-xs text-muted-foreground italic">Nenhuma foto</p>
              )}
            </div>
          )
        })}
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
