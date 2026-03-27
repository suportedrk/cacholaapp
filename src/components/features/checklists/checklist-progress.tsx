import { cn } from '@/lib/utils'
import type { ChecklistItemStatus } from '@/types/database.types'

interface ChecklistProgressProps {
  items: Array<{ status: ChecklistItemStatus }>
  showLabel?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function calcProgress(items: Array<{ status: ChecklistItemStatus }>) {
  const total = items.length
  if (total === 0) return { done: 0, na: 0, total: 0, pct: 0 }
  const done = items.filter((i) => i.status === 'done').length
  const na   = items.filter((i) => i.status === 'na').length
  const pct  = Math.round((done / total) * 100)
  return { done, na, total, pct }
}

export function ChecklistProgress({
  items,
  showLabel = true,
  size = 'md',
  className,
}: ChecklistProgressProps) {
  const { done, na, total, pct } = calcProgress(items)

  return (
    <div className={cn('w-full space-y-1', className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {done} de {total} concluídos
            {na > 0 && <span className="ml-1 opacity-60">· {na} N/A</span>}
          </span>
          <span className="font-medium text-foreground">{pct}%</span>
        </div>
      )}
      <div
        className={cn(
          'w-full rounded-full bg-muted overflow-hidden',
          size === 'sm' ? 'h-1.5' : 'h-2'
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-primary' : 'bg-amber-400'
          )}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  )
}
