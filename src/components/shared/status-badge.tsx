import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  active: boolean
  className?: string
}

export function StatusBadge({ active, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
        active
          ? 'bg-green-100 text-green-700'
          : 'bg-muted text-muted-foreground',
        className
      )}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          active ? 'bg-green-500' : 'bg-muted-foreground/50'
        )}
      />
      {active ? 'Ativo' : 'Inativo'}
    </span>
  )
}
