'use client'

import { getInitials, getAvatarColor, cn } from '@/lib/utils'

interface ProviderAvatarProps {
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_CLASSES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-base',
} as const

export function ProviderAvatar({ name, size = 'md', className }: ProviderAvatarProps) {
  const initials = getInitials(name)
  const colorClass = getAvatarColor(name)

  return (
    <span
      aria-label={`Avatar de ${name}`}
      className={cn(
        'inline-flex items-center justify-center rounded-full font-semibold shrink-0 select-none',
        SIZE_CLASSES[size],
        colorClass,
        className,
      )}
    >
      {initials}
    </span>
  )
}
