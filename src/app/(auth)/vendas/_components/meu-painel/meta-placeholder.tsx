'use client'

import { Lock } from 'lucide-react'

export function MetaPlaceholder() {
  return (
    <div className="bg-card rounded-xl border border-border-default p-4 flex items-center gap-3">
      <span className="icon-amber rounded-md p-2 shrink-0">
        <Lock className="w-4 h-4" />
      </span>
      <div>
        <p className="text-sm font-medium text-text-primary">Meta mensal</p>
        <p className="text-xs text-text-tertiary">Em breve — aguardando integração Ploomes</p>
      </div>
    </div>
  )
}
