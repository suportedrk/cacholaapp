import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type ReportStatsCardProps = {
  title:     string
  value:     string | number | null
  subtitle?: string
  icon:      LucideIcon
  loading?:  boolean
  className?: string
  accent?:   'default' | 'success' | 'warning' | 'danger'
}

const accentMap = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  danger:  'bg-red-100 text-red-700',
}

export function ReportStatsCard({
  title, value, subtitle, icon: Icon,
  loading, className, accent = 'default',
}: ReportStatsCardProps) {
  if (loading) {
    return (
      <div className={cn('rounded-xl border bg-card p-5 space-y-3 animate-pulse', className)}>
        <div className="flex items-center justify-between">
          <div className="h-4 w-28 bg-muted rounded" />
          <div className="h-8 w-8 bg-muted rounded-lg" />
        </div>
        <div className="h-7 w-20 bg-muted rounded" />
        <div className="h-3 w-32 bg-muted rounded" />
      </div>
    )
  }

  return (
    <div className={cn('rounded-xl border bg-card p-5 space-y-2', className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground font-medium">{title}</p>
        <span className={cn('p-2 rounded-lg', accentMap[accent])}>
          <Icon className="w-4 h-4" />
        </span>
      </div>
      <p className="text-2xl font-bold text-foreground tracking-tight">
        {value ?? '—'}
      </p>
      {subtitle && (
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      )}
    </div>
  )
}
