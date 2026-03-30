'use client'

import { parseISO, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Clock, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function formatDuration(ms: number): string {
  const abs = Math.abs(ms)
  const days    = Math.floor(abs / 86_400_000)
  const hours   = Math.floor((abs % 86_400_000) / 3_600_000)
  const minutes = Math.floor((abs % 3_600_000) / 60_000)

  if (days > 0 && hours > 0) return `${days} dia${days !== 1 ? 's' : ''} e ${hours}h`
  if (days > 0)               return `${days} dia${days !== 1 ? 's' : ''}`
  if (hours > 0 && minutes > 0) return `${hours}h e ${minutes}min`
  if (hours > 0)              return `${hours} hora${hours !== 1 ? 's' : ''}`
  return `${Math.max(1, minutes)} minuto${minutes !== 1 ? 's' : ''}`
}

interface SlaBarProps {
  pct: number
  isOverdue: boolean
}

function SlaBar({ pct, isOverdue }: SlaBarProps) {
  const capped = Math.min(pct, 100)
  const barColor =
    isOverdue   ? 'bg-red-500'
    : pct >= 85 ? 'bg-red-500'
    : pct >= 65 ? 'bg-amber-500'
    :              'bg-green-500'

  return (
    <div className="h-2 rounded-full bg-muted overflow-hidden">
      <div
        className={cn(
          'h-full rounded-full transition-all duration-500',
          barColor,
          isOverdue && 'animate-pulse-sla',
        )}
        style={{ width: `${capped}%` }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
interface Props {
  createdAt: string
  dueDate:   string  // yyyy-MM-dd
}

export function SlaCard({ createdAt, dueDate }: Props) {
  // eslint-disable-next-line react-hooks/purity
  const now      = Date.now()
  const created  = new Date(createdAt).getTime()
  const due      = parseISO(dueDate + 'T23:59:59').getTime()

  const total    = due - created
  const elapsed  = now - created
  const remaining = due - now
  const isOverdue = remaining < 0

  const pct = total > 0 ? Math.round((elapsed / total) * 100) : 0

  const createdLabel  = format(new Date(createdAt), "d MMM yyyy 'às' HH:mm", { locale: ptBR })
  const dueLabel      = format(parseISO(dueDate), "d MMM yyyy", { locale: ptBR })
  const elapsedLabel  = total > 0 ? formatDuration(elapsed) : '—'
  const remainingLabel = isOverdue
    ? formatDuration(Math.abs(remaining)) + ' além do prazo'
    : formatDuration(remaining)

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Clock className="w-4 h-4 text-primary" />
        SLA
      </h2>
      <Separator />

      {/* Bar + percentage */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{Math.min(pct, 100)}% decorrido</span>
          {isOverdue && (
            <span className="text-red-500 font-semibold">ATRASADA</span>
          )}
        </div>
        <SlaBar pct={pct} isOverdue={isOverdue} />
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Criada em</p>
          <p className="font-medium text-foreground">{createdLabel}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Prazo</p>
          <p className="font-medium text-foreground">{dueLabel}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Tempo decorrido</p>
          <p className="font-medium text-foreground">{elapsedLabel}</p>
        </div>
        <div>
          <p className={cn('text-muted-foreground', isOverdue && 'text-red-500')}>
            {isOverdue ? 'Atraso' : 'Tempo restante'}
          </p>
          <p className={cn(
            'font-semibold',
            isOverdue ? 'text-red-600 dark:text-red-400' : pct >= 85 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400',
          )}>
            {remainingLabel}
          </p>
        </div>
      </div>

      {/* Overdue banner inside card */}
      {isOverdue && (
        <div className="flex items-center gap-2 rounded-lg bg-status-error-bg border border-red-200 dark:border-red-900/50 px-3 py-2 text-status-error-text text-xs">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span className="font-medium">
            Esta ordem está {formatDuration(Math.abs(remaining))} além do prazo
          </span>
        </div>
      )}
    </div>
  )
}
