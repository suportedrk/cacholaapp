'use client'

import { cn } from '@/lib/utils'
import type { UpsellSource } from '@/hooks/use-upsell'

interface UpsellSourceTabsProps {
  source:               UpsellSource
  onSourceChange:       (s: UpsellSource) => void
  mineCount:            number
  carteiraLivreCount:   number
}

const TABS: { value: UpsellSource; label: string; getCount: (m: number, c: number) => number }[] = [
  { value: 'mine',           label: 'Minhas',        getCount: (m) => m },
  { value: 'carteira_livre', label: 'Carteira Livre', getCount: (_, c) => c },
  { value: 'all',            label: 'Todas',          getCount: (m, c) => m + c },
]

export function UpsellSourceTabs({
  source,
  onSourceChange,
  mineCount,
  carteiraLivreCount,
}: UpsellSourceTabsProps) {
  return (
    <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit">
      {TABS.map((tab) => {
        const count   = tab.getCount(mineCount, carteiraLivreCount)
        const isActive = source === tab.value
        return (
          <button
            key={tab.value}
            onClick={() => onSourceChange(tab.value)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
              isActive
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
            {count > 0 && (
              <span className={cn(
                'text-xs rounded-full px-1.5 py-0.5 font-medium',
                isActive
                  ? tab.value === 'carteira_livre'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                    : 'bg-primary/15 text-primary'
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
