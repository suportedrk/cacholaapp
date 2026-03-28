'use client'

import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export type FilterChipColor =
  | 'brand' | 'amber' | 'red' | 'green' | 'blue' | 'purple' | 'orange' | 'gray'

/** Classe badge quando o chip está ativo (usa o mesmo sistema .badge-*) */
const ACTIVE_CLASS: Record<FilterChipColor, string> = {
  brand:  'badge-brand  border font-semibold',
  amber:  'badge-amber  border font-semibold',
  red:    'badge-red    border font-semibold',
  green:  'badge-green  border font-semibold',
  blue:   'badge-blue   border font-semibold',
  purple: 'badge-purple border font-semibold',
  orange: 'badge-orange border font-semibold',
  gray:   'badge-gray   border font-semibold',
}

interface FilterChipProps {
  label: string
  active: boolean
  color?: FilterChipColor
  icon?: ReactNode
  onClick: () => void
  className?: string
}

export function FilterChip({
  label,
  active,
  color = 'gray',
  icon,
  onClick,
  className,
}: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        // base
        'inline-flex items-center gap-1 rounded-full px-3 text-xs font-medium',
        // touch target mínimo 44px (altura via py + min-h)
        'py-1.5 min-h-[2rem]',
        // transição
        'transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        // estado inativo: sutil, ghost
        !active && [
          'border border-border bg-transparent text-muted-foreground',
          'hover:border-border-strong hover:text-foreground hover:bg-muted/50',
          'hover:scale-[1.02]',
        ],
        // estado ativo: cor semântica
        active && [ACTIVE_CLASS[color], 'scale-[1.0] shadow-xs'],
        className,
      )}
    >
      {icon && (
        <span className="shrink-0 [&>svg]:size-3">{icon}</span>
      )}
      {label}
    </button>
  )
}
