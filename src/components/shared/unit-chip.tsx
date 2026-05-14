import { Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UnitChipProps {
  slug?: string | null
  name?: string | null
  size?: 'sm' | 'md'
  className?: string
}

export function UnitChip({ slug, name, size = 'sm', className }: UnitChipProps) {
  const isNull = !slug && !name
  const isMoema = !isNull && (
    (slug ?? '').toLowerCase().includes('moema') ||
    (name ?? '').toLowerCase().includes('moema')
  )

  const label = isNull
    ? 'Sem unidade'
    : (name ?? slug ?? 'Sem unidade').split(' ').pop() ?? 'Sem unidade'

  const colorClasses = isNull
    ? 'bg-gray-100 text-gray-600 border-gray-200'
    : isMoema
      ? 'bg-terracota-100 text-terracota-700 border-terracota-200'
      : 'bg-brand-100 text-brand-700 border-brand-200'

  const sizeClasses = size === 'md'
    ? 'px-2.5 py-1 text-sm'
    : 'px-2 py-0.5 text-xs'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium border',
        colorClasses,
        sizeClasses,
        className,
      )}
    >
      <Building2 className="w-3 h-3 shrink-0" aria-hidden />
      {label}
    </span>
  )
}
