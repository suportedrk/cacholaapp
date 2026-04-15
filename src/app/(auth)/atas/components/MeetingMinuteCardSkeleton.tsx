'use client'

import { Skeleton } from '@/components/ui/skeleton'

export function MeetingMinuteCardSkeleton() {
  return (
    <article className="rounded-xl border bg-card p-4 flex flex-col gap-3">
      {/* Título + badge */}
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full shrink-0" />
      </div>

      {/* Data + local */}
      <div className="space-y-1">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-3 w-32" />
      </div>

      {/* Participantes + action items */}
      <div className="flex items-center justify-between border-t border-border pt-2.5">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            <Skeleton className="w-6 h-6 rounded-full" />
            <Skeleton className="w-6 h-6 rounded-full" />
            <Skeleton className="w-6 h-6 rounded-full" />
          </div>
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-3 w-10" />
      </div>

      {/* Criado por */}
      <Skeleton className="h-3 w-36" />
    </article>
  )
}
