'use client'

import { ArrowRight, CheckCircle2 } from 'lucide-react'
import type { PloomesConfigRow } from '@/types/database.types'

type StatusMappingEntry = {
  statusId: number
  statusName: string
  description: string
  cacholaAction: string
}

type Props = {
  config: PloomesConfigRow
}

const EVENT_STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  pending:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  finished:  'bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400',
  skip:      'bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400',
}

const EVENT_STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmado',
  pending:   'Pendente',
  finished:  'Finalizado',
  skip:      'Ignorado',
}

const PLOOMES_STATUS_COLORS: Record<string, string> = {
  Ganho:      'bg-green-100 text-green-700',
  Perdido:    'bg-red-100 text-red-700',
  'Em aberto': 'bg-blue-100 text-blue-700',
}

export function MappingStatusCard({ config }: Props) {
  // status_mappings pode ser array (novo formato) ou objeto (legado)
  const raw = config.status_mappings
  const entries: StatusMappingEntry[] = Array.isArray(raw)
    ? (raw as StatusMappingEntry[])
    : Object.entries(raw as Record<string, string>).map(([statusName, cacholaAction], i) => ({
        statusId: i + 1,
        statusName,
        description: '',
        cacholaAction,
      }))

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
            Status do deal no Ploomes → ação no evento do Cachola OS
          </p>
        </div>
      </div>

      {/* Nota de contexto */}
      <div className="px-5 py-3 bg-primary/5 border-b border-border text-xs text-muted-foreground">
        Deals no stage <span className="font-medium text-foreground">Festa Fechada</span> são importados
        — exceto <span className="font-medium text-foreground">Perdido</span> (negócio não fechado).
      </div>

      {/* Rows */}
      {entries.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground text-center">
          Nenhum mapeamento de status configurado.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {entries.map((entry) => (
            <div key={entry.statusId} className="flex items-start gap-3 px-5 py-3">
              {/* StatusId badge */}
              <span className="shrink-0 inline-flex items-center justify-center h-5 w-5 rounded text-[10px] font-mono font-bold bg-muted text-muted-foreground mt-0.5">
                {entry.statusId}
              </span>

              {/* Nome Ploomes */}
              <div className="flex-1 min-w-0">
                <span
                  className={[
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                    PLOOMES_STATUS_COLORS[entry.statusName] ?? 'bg-muted text-muted-foreground',
                  ].join(' ')}
                >
                  {entry.statusName}
                </span>
                {entry.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{entry.description}</p>
                )}
              </div>

              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-1" />

              {/* Ação Cachola */}
              <span
                className={[
                  'shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                  EVENT_STATUS_COLORS[entry.cacholaAction] ?? 'bg-muted text-muted-foreground',
                ].join(' ')}
              >
                {EVENT_STATUS_LABELS[entry.cacholaAction] ?? entry.cacholaAction}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
