import { Skeleton } from '@/components/ui/skeleton'

export default function AtaDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Back link */}
      <Skeleton className="h-4 w-28" />

      {/* Status badge + title */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
      </div>

      {/* Participants */}
      <div className="rounded-xl border bg-card p-5 sm:p-6 space-y-4">
        <Skeleton className="h-4 w-28" />
        <div className="flex flex-wrap gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-xl border bg-card p-5 sm:p-6 space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>

      {/* Action items */}
      <div className="rounded-xl border bg-card p-5 sm:p-6 space-y-4">
        <Skeleton className="h-4 w-44" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <Skeleton className="h-4 w-64" />
    </div>
  )
}
