'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SupplierRatingProps {
  value:    number | null
  onChange?: (rating: number | null) => void
  size?:    'sm' | 'md'
  className?: string
}

export function SupplierRating({
  value,
  onChange,
  size = 'md',
  className,
}: SupplierRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const interactive = !!onChange

  const starSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5'
  const display = hovered ?? value ?? 0

  return (
    <div
      className={cn('flex items-center gap-0.5', className)}
      onMouseLeave={() => setHovered(null)}
      aria-label={`Avaliação: ${value ?? 0} de 5 estrelas`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => {
            if (!onChange) return
            // Click the already-selected star → remove rating
            onChange(star === value ? null : star)
          }}
          onMouseEnter={() => interactive && setHovered(star)}
          className={cn(
            'transition-transform',
            interactive && 'cursor-pointer hover:scale-110',
            !interactive && 'cursor-default',
          )}
          aria-label={`${star} estrela${star > 1 ? 's' : ''}`}
        >
          <Star
            className={cn(
              starSize,
              'transition-colors',
              star <= display
                ? 'fill-amber-400 text-amber-400'
                : 'fill-transparent text-gray-300 dark:text-gray-600',
            )}
          />
        </button>
      ))}
    </div>
  )
}
