'use client'

import { cn } from '@/lib/utils'

interface StarRatingProps {
  rating: number
  maxStars?: number
  size?: 'sm' | 'md'
  showValue?: boolean
  showCount?: boolean
  count?: number
  interactive?: boolean
  onChange?: (rating: number) => void
  className?: string
}

const SIZE_PX = { sm: 14, md: 18 } as const

export function StarRating({
  rating,
  maxStars = 5,
  size = 'sm',
  showValue = false,
  showCount = false,
  count,
  interactive = false,
  onChange,
  className,
}: StarRatingProps) {
  const px = SIZE_PX[size]

  return (
    <span
      className={cn('inline-flex items-center gap-0.5', className)}
      role={interactive ? 'slider' : undefined}
      aria-label={`Avaliação: ${rating.toFixed(1)} de ${maxStars} estrelas`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? maxStars : undefined}
      aria-valuenow={interactive ? Math.round(rating) : undefined}
    >
      {Array.from({ length: maxStars }, (_, i) => {
        const fill = Math.max(0, Math.min(1, rating - i)) // 0–1 for this star
        const fillPct = Math.round(fill * 100)

        return (
          <span
            key={i}
            className={cn('relative inline-block shrink-0', interactive && 'cursor-pointer')}
            style={{ width: px, height: px }}
            onClick={interactive ? () => onChange?.(i + 1) : undefined}
            title={interactive ? `${i + 1} estrela${i > 0 ? 's' : ''}` : undefined}
          >
            {/* Empty star (background) */}
            <svg
              width={px}
              height={px}
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="absolute inset-0"
            >
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                fill="currentColor"
                className="text-gray-200 dark:text-gray-700"
              />
            </svg>

            {/* Filled star (foreground, clipped) */}
            {fillPct > 0 && (
              <svg
                width={px}
                height={px}
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="absolute inset-0"
                style={{ clipPath: `inset(0 ${100 - fillPct}% 0 0)` }}
              >
                <path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  fill="currentColor"
                  className="text-amber-400"
                />
              </svg>
            )}
          </span>
        )
      })}

      {showValue && (
        <span className="ml-1 text-xs font-medium text-foreground tabular-nums">
          {rating.toFixed(1)}
        </span>
      )}

      {showCount && count !== undefined && (
        <span className="ml-0.5 text-xs text-muted-foreground">
          ({count})
        </span>
      )}
    </span>
  )
}
