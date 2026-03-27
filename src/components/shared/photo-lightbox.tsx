'use client'

import { useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LightboxPhoto {
  id: string
  signedUrl: string
  label?: string
}

interface PhotoLightboxProps {
  photos: LightboxPhoto[]
  initialIndex?: number
  open: boolean
  onClose: () => void
  currentIndex: number
  onIndexChange: (index: number) => void
}

export function PhotoLightbox({
  photos,
  open,
  onClose,
  currentIndex,
  onIndexChange,
}: PhotoLightboxProps) {
  const photo = photos[currentIndex]

  const prev = useCallback(() => {
    onIndexChange((currentIndex - 1 + photos.length) % photos.length)
  }, [currentIndex, photos.length, onIndexChange])

  const next = useCallback(() => {
    onIndexChange((currentIndex + 1) % photos.length)
  }, [currentIndex, photos.length, onIndexChange])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose, prev, next])

  if (!open || !photo) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      {/* Close */}
      <button
        type="button"
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
        onClick={onClose}
        aria-label="Fechar"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Counter + label */}
      {(photo.label || photos.length > 1) && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
          {photos.length > 1 && (
            <span className="text-white/70 text-xs">
              {currentIndex + 1} / {photos.length}
            </span>
          )}
          {photo.label && (
            <span className="px-2 py-0.5 rounded bg-black/40 text-white text-xs font-medium">
              {photo.label}
            </span>
          )}
        </div>
      )}

      {/* Prev */}
      {photos.length > 1 && (
        <button
          type="button"
          className="absolute left-3 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
          onClick={(e) => { e.stopPropagation(); prev() }}
          aria-label="Anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      {/* Image */}
      <div
        className="max-w-[90vw] max-h-[85vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={photo.id}
          src={photo.signedUrl}
          alt={photo.label ?? 'foto'}
          className={cn(
            'max-w-full max-h-[85vh] rounded-lg object-contain',
            'shadow-2xl'
          )}
        />
      </div>

      {/* Next */}
      {photos.length > 1 && (
        <button
          type="button"
          className="absolute right-3 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
          onClick={(e) => { e.stopPropagation(); next() }}
          aria-label="Próxima"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}
