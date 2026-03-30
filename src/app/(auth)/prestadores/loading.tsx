import { Skeleton } from '@/components/ui/skeleton'
import { ProviderCardSkeleton } from './components/ProviderCardSkeleton'

export default function PrestadoresLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 flex flex-col gap-2">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full rounded-lg" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-36 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <ProviderCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
