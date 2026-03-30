'use client'

import { Skeleton } from '@/components/ui/skeleton'

export function ProviderCardSkeleton() {
  return (
    <article className="rounded-xl border bg-card p-4 flex flex-col gap-3">
      {/* Avatar + nome + badge */}
      <div className="flex items-start gap-3">
        <Skeleton className="w-12 h-12 rounded-full shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>

      {/* Estrelas */}
      <Skeleton className="h-3 w-32" />

      {/* Tags */}
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>

      {/* Contato */}
      <Skeleton className="h-3 w-36" />

      {/* Métricas */}
      <div className="flex gap-3 mt-1">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-20" />
      </div>
    </article>
  )
}
