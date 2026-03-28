'use client'

import { ArrowRight, CheckCircle2 } from 'lucide-react'
import type { PloomesConfigRow } from '@/types/database.types'

type Props = {
  config: PloomesConfigRow
}

// Status do sistema → cor do badge
const EVENT_STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  pending:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
}

const EVENT_STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmado',
  pending:   'Pendente',
  cancelled: 'Cancelado',
  completed: 'Concluído',
}

// Status Ploomes → cor do badge
const PLOOMES_STATUS_COLORS: Record<string, string> = {
  Won:    'bg-green-100 text-green-700',
  Lost:   'bg-red-100 text-red-700',
  Open:   'bg-blue-100 text-blue-700',
  Paused: 'bg-gray-100 text-gray-700',
}

export function MappingStatusCard({ config }: Props) {
  const entries = Object.entries(config.status_mappings)

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-secondary/30">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <CheckCircle2 className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Status do Deal</h3>
          <p className="text-xs text-muted-foreground">
            Status do deal no Ploomes → status do evento no sistema
          </p>
        </div>
      </div>

      {/* Rows */}
      {entries.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground text-center">
          Nenhum mapeamento de status configurado.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {entries.map(([ploomesStatus, eventStatus]) => (
            <div key={ploomesStatus} className="flex items-center gap-4 px-5 py-3">
              {/* Status Ploomes */}
              <span
                className={[
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                  PLOOMES_STATUS_COLORS[ploomesStatus] ?? 'bg-muted text-muted-foreground',
                ].join(' ')}
              >
                {ploomesStatus}
              </span>

              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />

              {/* Status interno */}
              <span
                className={[
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                  EVENT_STATUS_COLORS[eventStatus] ?? 'bg-muted text-muted-foreground',
                ].join(' ')}
              >
                {EVENT_STATUS_LABELS[eventStatus] ?? eventStatus}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
