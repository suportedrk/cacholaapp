'use client'

import { Cake, PartyPopper } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RecompraType } from '@/hooks/use-recompra'

interface RecompraTypeTabsProps {
  activeType:        RecompraType
  onTypeChange:      (t: RecompraType) => void
  aniversarioCount:  number
  festaPassadaCount: number
}

const TABS: {
  value:    RecompraType
  label:    string
  icon:     React.ElementType
  getCount: (a: number, f: number) => number
}[] = [
  { value: 'aniversario',   label: 'Aniversário',   icon: Cake,        getCount: (a) => a },
  { value: 'festa_passada', label: 'Festa Passada',  icon: PartyPopper, getCount: (_, f) => f },
]

export function RecompraTypeTabs({
  activeType,
  onTypeChange,
  aniversarioCount,
  festaPassadaCount,
}: RecompraTypeTabsProps) {
  return (
    <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit">
      {TABS.map((tab) => {
        const count    = tab.getCount(aniversarioCount, festaPassadaCount)
        const isActive = activeType === tab.value
        const Icon     = tab.icon
        return (
          <button
            key={tab.value}
            onClick={() => onTypeChange(tab.value)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
              isActive
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            {tab.label}
            {count > 0 && (
              <span className={cn(
                'text-xs rounded-full px-1.5 py-0.5 font-medium',
                isActive
                  ? 'bg-primary/15 text-primary'
                  : 'bg-muted-foreground/20 text-muted-foreground',
              )}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
