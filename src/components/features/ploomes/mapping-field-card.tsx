'use client'

import { Database } from 'lucide-react'
import type { PloomesConfigRow } from '@/types/database.types'

type Props = {
  config: PloomesConfigRow
}

// Parser → rótulo legível em PT-BR
const PARSER_LABELS: Record<string, string> = {
  date:   'Data',
  time:   'Hora',
  string: 'Texto',
  number: 'Número',
}

// ValueKey → rótulo legível
const VALUE_KEY_LABELS: Record<string, string> = {
  DateTimeValue:   'DateTimeValue',
  StringValue:     'StringValue',
  IntegerValue:    'IntegerValue',
  DecimalValue:    'DecimalValue',
  ObjectValueName: 'ObjectValueName',
}

export function MappingFieldCard({ config }: Props) {
  const entries = Object.entries(config.field_mappings)

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-secondary/30">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Database className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Campos da Festa</h3>
          <p className="text-xs text-muted-foreground">
            Campos customizados do deal Ploomes → campos do evento no sistema
          </p>
        </div>
      </div>

      {/* Tabela */}
      {entries.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground text-center">
          Nenhum mapeamento configurado.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Campo Ploomes</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Campo Interno</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Tipo de Valor</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Parser</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map(([fieldKey, def]) => (
                <tr key={fieldKey} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{def.label}</span>
                      <code className="text-xs text-muted-foreground font-mono">{fieldKey}</code>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{def.field}</code>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                    {VALUE_KEY_LABELS[def.valueKey] ?? def.valueKey}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {PARSER_LABELS[def.parser] ?? def.parser}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
