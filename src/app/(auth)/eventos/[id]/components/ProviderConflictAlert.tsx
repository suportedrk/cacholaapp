'use client'

import { AlertTriangle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { EventProvider } from '@/types/providers'

interface Props {
  conflicts: EventProvider[]
}

export function ProviderConflictAlert({ conflicts }: Props) {
  if (conflicts.length === 0) return null

  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
          {conflicts.length === 1
            ? 'Este prestador já tem 1 compromisso nesta data'
            : `Este prestador já tem ${conflicts.length} compromissos nesta data`}
        </p>
        <ul className="mt-1 space-y-0.5">
          {conflicts.map((c) => (
            <li key={c.id} className="text-xs text-amber-700 dark:text-amber-400/80">
              · {c.event?.title ?? 'Evento sem título'}
              {c.event?.date && (
                <> — {format(parseISO(c.event.date), "d 'de' MMM", { locale: ptBR })}</>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
