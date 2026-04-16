'use client'

import { memo } from 'react'
import { Shield, Clock, Phone, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CalendarPreReserva } from '@/types/pre-reservas'
import type { ConflictType } from './event-card'

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

interface PreReservaCardProps {
  item:          CalendarPreReserva
  conflictType?: ConflictType
  onDetailClick: (item: CalendarPreReserva) => void
}

// ─────────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────────

export const PreReservaCard = memo(function PreReservaCard({
  item,
  conflictType = null,
  onDetailClick,
}: PreReservaCardProps) {
  return (
    <button
      type="button"
      onClick={() => onDetailClick(item)}
      className={cn(
        'group w-full text-left bg-card rounded-xl border border-border p-4',
        'hover:border-emerald-400/60 card-interactive',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
      )}
    >
      {/* Linha 1: horário + badges */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 text-xs text-text-secondary font-medium">
          {item.start_time ? (
            <>
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>
                {item.start_time}
                {item.end_time ? ` – ${item.end_time}` : ''}
              </span>
            </>
          ) : (
            <span className="text-text-tertiary italic text-xs">Sem horário</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {conflictType === 'overlap' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-400">
              <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
              Sobreposição
            </span>
          )}
          {conflictType === 'short_gap' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
              <Clock className="h-2.5 w-2.5 shrink-0" />
              Intervalo &lt; 2h
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800">
            <Shield className="h-2.5 w-2.5 shrink-0" />
            Pré-venda
          </span>
        </div>
      </div>

      {/* Corpo: ícone + nome do cliente */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full shrink-0 flex items-center justify-center bg-emerald-500/10">
          <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className={cn(
            'font-semibold text-text-primary text-base leading-tight line-clamp-1',
            'group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors',
          )}>
            {item.title}
          </h3>
          {item.description && (
            <p className="text-sm text-text-secondary mt-0.5 line-clamp-1">{item.description}</p>
          )}
        </div>
      </div>

      {/* Contato (sempre visível no mobile, expande ao hover desktop) */}
      {item.client_contact && (
        <div className={cn(
          'overflow-hidden transition-all duration-200 ease-out',
          'max-h-10',
          'sm:max-h-0 sm:group-hover:max-h-10',
        )}>
          <div className="flex items-center gap-1.5 pt-2.5 mt-2.5 border-t border-border">
            <Phone className="w-3 h-3 shrink-0 text-text-tertiary" />
            <span className="text-xs text-text-secondary line-clamp-1">{item.client_contact}</span>
          </div>
        </div>
      )}
    </button>
  )
})
