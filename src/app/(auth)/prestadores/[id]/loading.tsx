import { Skeleton } from '@/components/ui/skeleton'

export default function LoadingPrestadorDetalhe() {
  return (
    <div className="max-w-3xl space-y-4 pb-24 md:pb-0">
      {/* Header skeleton */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Skeleton className="w-14 h-14 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3.5 w-28" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3.5 w-56" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-20 rounded-lg" />
          <Skeleton className="h-7 w-24 rounded-lg" />
          <Skeleton className="h-7 w-8 rounded-lg" />
        </div>
      </div>

      {/* Accordion skeletons */}
      <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2.5 px-4 py-3.5">
            <Skeleton className="w-4 h-4 rounded" />
            <Skeleton className="h-4 flex-1 max-w-32" />
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-4 w-4 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
