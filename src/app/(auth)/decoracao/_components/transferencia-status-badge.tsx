import { CheckCircle2, Truck, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TransferenciaStatus } from '@/types/decoracao'

const CONFIG: Record<
  TransferenciaStatus,
  { label: string; classes: string; Icon: typeof Truck }
> = {
  em_transito: {
    label: 'Em trânsito',
    classes: 'badge-amber border',
    Icon: Truck,
  },
  recebida: {
    label: 'Recebida',
    classes: 'badge-green border',
    Icon: CheckCircle2,
  },
  cancelada: {
    label: 'Cancelada',
    classes: 'badge-gray border',
    Icon: XCircle,
  },
}

export function TransferenciaStatusBadge({
  status,
  className,
}: {
  status: TransferenciaStatus
  className?: string
}) {
  const c = CONFIG[status]
  const Icon = c.Icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        c.classes,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {c.label}
    </span>
  )
}
