'use client'

import { useState } from 'react'
import { Mail, Phone, User, Star, CheckCircle, RotateCcw, Flame, Zap, Cake, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { RecompraContactDialog } from './recompra-contact-dialog'
import { RecompraReopenDialog } from './recompra-reopen-dialog'
import type { RecompraAniversarioOpp } from '@/hooks/use-recompra'

// ── Urgency chip ──────────────────────────────────────────────

function urgencyLabel(days: number): string {
  if (days === 0)  return 'Aniversário HOJE'
  if (days === 1)  return 'Aniversário amanhã'
  if (days <= 7)   return `Em ${days} dias`
  return `Em ${days} dias`
}

interface UrgencyConfig {
  label:   string
  icon:    React.ElementType
  chipCls: string
}

function getUrgency(days: number): UrgencyConfig {
  if (days <= 7) return {
    label:   urgencyLabel(days),
    icon:    Flame,
    chipCls: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800',
  }
  if (days <= 30) return {
    label:   urgencyLabel(days),
    icon:    Zap,
    chipCls: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-400 dark:border-orange-800',
  }
  if (days <= 60) return {
    label:   urgencyLabel(days),
    icon:    Cake,
    chipCls: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800',
  }
  return {
    label:   urgencyLabel(days),
    icon:    CalendarDays,
    chipCls: 'bg-muted text-muted-foreground border-border',
  }
}

// ── Outcome badge ─────────────────────────────────────────────

const OUTCOME_LABELS: Record<string, { label: string; cls: string }> = {
  tentou:  { label: 'Tentativa',  cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' },
  recusou: { label: 'Recusou',    cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  vendeu:  { label: 'Vendeu!',    cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
  outro:   { label: 'Outro',      cls: 'bg-muted text-muted-foreground' },
}

// ── Component ─────────────────────────────────────────────────

interface Props {
  opportunity: RecompraAniversarioOpp
  canRegister: boolean
}

export function RecompraCardAniversario({ opportunity: opp, canRegister }: Props) {
  const [contactOpen, setContactOpen] = useState(false)
  const [reopenLogId, setReopenLogId] = useState<string | null>(null)

  const urgency     = getUrgency(opp.days_until_birthday)
  const UrgencyIcon = urgency.icon
  const isContacted = !!opp.log_id
  const phone       = opp.contact_phones?.[0]?.PhoneNumber ?? null
  const outcome     = opp.log_outcome ? OUTCOME_LABELS[opp.log_outcome] : null

  const nextBdayFormatted = new Date(opp.next_birthday + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

  function handleCardClick() {
    if (!opp.deal_id) {
      console.warn('[RecompraCardAniversario] deal_id ausente — não foi possível abrir o Ploomes.')
      return
    }
    window.open(`https://app10.ploomes.com/deal/${opp.deal_id}`, '_blank', 'noopener,noreferrer')
  }

  function handleCardKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter') {
      handleCardClick()
    } else if (e.key === ' ') {
      e.preventDefault()
      handleCardClick()
    }
  }

  const ariaLabel = isContacted
    ? `Abrir negócio ${opp.contact_name} no Ploomes (já contatado)`
    : `Abrir negócio ${opp.contact_name} no Ploomes`

  return (
    <>
      <div
        role="link"
        tabIndex={0}
        aria-label={ariaLabel}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        className={cn(
          'rounded-lg border bg-card p-4 space-y-3 transition-all focus-ring',
          isContacted
            ? 'opacity-70 border-border cursor-pointer hover:opacity-90'
            : 'border-border card-interactive',
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            {/* Urgency chip */}
            <span
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className={cn(
                'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border',
                urgency.chipCls,
              )}
            >
              <UrgencyIcon className="w-3 h-3" />
              {urgency.label}
            </span>
            <p className="text-[11px] text-muted-foreground">
              Aniversário: {nextBdayFormatted}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            {opp.is_carteira_livre && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                <Star className="w-2.5 h-2.5" /> Carteira Livre
              </span>
            )}
            {isContacted && outcome && (
              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', outcome.cls)}>
                {outcome.label}
              </span>
            )}
          </div>
        </div>

        {/* Contact info */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-foreground">
            <User className="w-3 h-3 shrink-0 text-muted-foreground" />
            <span className="font-medium truncate">{opp.contact_name}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Mail className="w-3 h-3 shrink-0" />
            <span className="truncate">{opp.contact_email}</span>
          </div>
          {phone && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="w-3 h-3 shrink-0" />
              <span>{phone}</span>
            </div>
          )}
          {opp.contact_owner_name && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="w-3 h-3 shrink-0 opacity-50" />
              <span>Resp.: {opp.contact_owner_name}</span>
            </div>
          )}
        </div>

        {/* Deal context */}
        {opp.deal_title && (
          <p className="text-[11px] text-muted-foreground/70 truncate">
            Última festa: {opp.deal_title}
          </p>
        )}

        {/* Action row */}
        <div className="flex items-center gap-2 pt-0.5">
          {!isContacted ? (
            <Button
              size="sm"
              className="h-7 text-xs flex-1"
              onClick={(e) => { e.stopPropagation(); setContactOpen(true) }}
              disabled={!canRegister}
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              {opp.is_carteira_livre ? 'Capturar e registrar' : 'Registrar contato'}
            </Button>
          ) : (
            <>
              <p className="text-xs text-muted-foreground flex-1">
                Contatado em{' '}
                {opp.log_contacted_at
                  ? new Date(opp.log_contacted_at).toLocaleDateString('pt-BR')
                  : '—'}
              </p>
              {canRegister && opp.log_id && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={(e) => { e.stopPropagation(); setReopenLogId(opp.log_id) }}
                >
                  <RotateCcw className="w-3 h-3 mr-1" /> Reabrir
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <RecompraContactDialog
        opportunity={contactOpen ? {
          contact_email:           opp.contact_email,
          contact_name:            opp.contact_name,
          aniversariante_birthday: opp.aniversariante_birthday,
          is_carteira_livre:       opp.is_carteira_livre,
        } : null}
        recompraType="aniversario"
        onClose={() => setContactOpen(false)}
      />
      <RecompraReopenDialog
        logId={reopenLogId}
        onClose={() => setReopenLogId(null)}
      />
    </>
  )
}
