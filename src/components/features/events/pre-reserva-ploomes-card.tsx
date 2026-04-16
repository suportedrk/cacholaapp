'use client'

import { memo } from 'react'
import { Sparkles, Clock, Phone, AlertTriangle, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CalendarPreReserva } from '@/types/pre-reservas'
import type { ConflictType } from './event-card'

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

interface PreReservaPloomesCardProps {
  item:          CalendarPreReserva
  conflictType?: ConflictType
}

// ─────────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────────

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─────────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────────

export const PreReservaPloomesCard = memo(function PreReservaPloomesCard({
  item,
  conflictType = null,
}: PreReservaPloomesCardProps) {
  function openPloomes(e?: React.MouseEvent) {
    e?.stopPropagation()
    if (item.ploomes_url) {
      window.open(item.ploomes_url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <button
      type="button"
      onClick={openPloomes}
      className={cn(
        'group w-full text-left bg-card rounded-xl border border-pink-200 p-4',
        'hover:border-pink-300 card-interactive',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-200',
        'dark:border-pink-800 dark:hover:border-pink-700',
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
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Clock className="w-3 h-3 shrink-0" />
              <span className="italic text-[10px]">Horário a definir no Ploomes</span>
            </span>
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
          <span className="inline-flex items-center gap-1 rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-medium text-pink-700 border border-pink-200 dark:bg-pink-900/40 dark:text-pink-400 dark:border-pink-800">
            <Sparkles className="h-2.5 w-2.5 shrink-0" />
            Pré-reserva Ploomes
          </span>
        </div>
      </div>

      {/* Corpo: ícone + nome do cliente */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full shrink-0 flex items-center justify-center bg-pink-500/10">
          <Sparkles className="w-5 h-5 text-pink-600 dark:text-pink-400" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className={cn(
            'font-semibold text-text-primary text-base leading-tight line-clamp-1',
            'group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors',
          )}>
            {item.title}
          </h3>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
            {item.stage_name && (
              <span className="text-xs text-text-secondary line-clamp-1">{item.stage_name}</span>
            )}
            {item.deal_amount != null && item.deal_amount > 0 && (
              <span className="text-xs font-medium text-pink-600 dark:text-pink-400">
                {formatBRL(item.deal_amount)}
              </span>
            )}
          </div>
        </div>

        {/* Ícone de link externo */}
        <div className="shrink-0 mt-0.5">
          <ExternalLink className="w-3.5 h-3.5 text-text-tertiary group-hover:text-pink-500 transition-colors" />
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
