import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

interface StatsCardProps {
  title: string
  value: number | undefined
  icon: LucideIcon
  description?: string
  iconClass?: string  // e.g. 'bg-blue-50 text-blue-600'
  isLoading?: boolean
  onClick?: () => void
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  description,
  iconClass,
  isLoading,
  onClick,
}: StatsCardProps) {
  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
        <Skeleton className="h-8 w-14" />
        <Skeleton className="h-3 w-32" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'bg-card border border-border rounded-xl p-4 space-y-2',
        onClick && 'cursor-pointer hover:bg-muted/30 transition-colors'
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </p>
        <div
          className={cn(
            'flex items-center justify-center w-9 h-9 rounded-lg shrink-0',
            iconClass ?? 'bg-muted text-muted-foreground'
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-3xl font-bold text-foreground leading-none">{value ?? 0}</p>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  )
}
