'use client'

import { Lightbulb } from 'lucide-react'
import { useUpsellPopularAddons } from '@/hooks/use-upsell'

interface PopularAddonsHintProps {
  packageName: string | null
}

export function PopularAddonsHint({ packageName }: PopularAddonsHintProps) {
  const { data: addons } = useUpsellPopularAddons(packageName)

  if (!addons?.length) return null

  return (
    <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Lightbulb className="w-4 h-4 text-amber-500" />
        Mais vendidos com este pacote
      </div>
      <div className="flex flex-wrap gap-1.5">
        {addons.slice(0, 6).map((a) => (
          <span
            key={a.product_name}
            className="text-xs px-2 py-0.5 rounded-full border border-border bg-card text-muted-foreground"
          >
            {a.product_name}
          </span>
        ))}
      </div>
    </div>
  )
}
