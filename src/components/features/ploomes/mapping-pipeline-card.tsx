'use client'

import { GitBranch } from 'lucide-react'
import type { PloomesConfigRow } from '@/types/database.types'

type Props = {
  config: PloomesConfigRow
}

export function MappingPipelineCard({ config }: Props) {
  const rows = [
    { label: 'Pipeline ID', value: String(config.pipeline_id), description: 'Funil onde as festas são rastreadas' },
    { label: 'Stage ID',    value: String(config.stage_id),    description: 'Etapa "Festa Fechada" dentro do funil' },
    { label: 'Status ID',   value: String(config.won_status_id), description: 'Status "Ganho" que filtra os deals importados' },
  ]

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-secondary/30">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <GitBranch className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Pipeline / Funil</h3>
          <p className="text-xs text-muted-foreground">Filtros que determinam quais deals são importados</p>
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-4 px-5 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{row.label}</p>
              <p className="text-xs text-muted-foreground">{row.description}</p>
            </div>
            <code className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs font-mono text-foreground">
              {row.value}
            </code>
          </div>
        ))}
      </div>
    </div>
  )
}
