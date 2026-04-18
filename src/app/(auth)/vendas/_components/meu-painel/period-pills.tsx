'use client'

import { cn } from '@/lib/utils'
import type { VendasPeriodKey, VendasPeriod } from '../shared/period-types'

interface Props {
  periods:  VendasPeriod[]
  selected: VendasPeriodKey
  onChange: (key: VendasPeriodKey) => void
}

export function PeriodPills({ periods, selected, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 bg-surface-secondary rounded-lg p-0.5 border border-border-default">
      {periods.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={cn(
            'px-2.5 py-1 rounded-md text-xs font-semibold transition-colors',
            selected === opt.key
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-tertiary',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
