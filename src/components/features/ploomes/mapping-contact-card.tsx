'use client'

import { User } from 'lucide-react'
import type { PloomesConfigRow } from '@/types/database.types'

type Props = {
  config: PloomesConfigRow
}

// Rótulos amigáveis para campos internos de contato
const FIELD_LABELS: Record<string, string> = {
  clientName:  'Nome do Cliente',
  clientEmail: 'E-mail',
  clientPhone: 'Telefone',
}

export function MappingContactCard({ config }: Props) {
  const entries = Object.entries(config.contact_mappings)

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-secondary/30">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <User className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Dados do Cliente</h3>
          <p className="text-xs text-muted-foreground">
            Campos do contato Ploomes → informações do cliente no evento
          </p>
        </div>
      </div>

      {/* Rows */}
      {entries.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground text-center">
          Nenhum mapeamento de contato configurado.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {entries.map(([internalField, ploomesPath]) => (
            <div key={internalField} className="flex items-center justify-between gap-4 px-5 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {FIELD_LABELS[internalField] ?? internalField}
                </p>
                <p className="text-xs text-muted-foreground font-mono">{internalField}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">←</span>
                <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono text-foreground">
                  Contact.{ploomesPath}
                </code>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
