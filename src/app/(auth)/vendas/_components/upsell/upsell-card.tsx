'use client'

import { useState } from 'react'
import { Calendar, Mail, Phone, User, Star, CheckCircle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ContactDialog } from './contact-dialog'
import { ReopenDialog } from './reopen-dialog'
import type { UpsellOpportunity } from '@/hooks/use-upsell'

// ── Helpers ───────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d     = new Date(dateStr + 'T00:00:00')
  return Math.round((d.getTime() - today.getTime()) / 86_400_000)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

const OUTCOME_LABELS: Record<string, { label: string; cls: string }> = {
  tentou:           { label: 'Tentativa',     cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' },
  recusou:          { label: 'Recusou',       cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  vendeu_adicional: { label: 'Adicional',     cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
  vendeu_upgrade:   { label: 'Upgrade',       cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
  outro:            { label: 'Outro',         cls: 'bg-muted text-muted-foreground' },
}

interface UpsellCardProps {
  opportunity:   UpsellOpportunity
  canRegister:   boolean
}

export function UpsellCard({ opportunity: opp, canRegister }: UpsellCardProps) {
  const [contactOpen, setContactOpen] = useState(false)
  const [reopenLogId, setReopenLogId] = useState<string | null>(null)

  const days       = daysUntil(opp.event_date)
  const isContacted = !!opp.log_id
  const phone       = opp.contact_phones?.[0]?.PhoneNumber ?? null
  const outcome     = opp.log_outcome ? OUTCOME_LABELS[opp.log_outcome] : null

  return (
    <>
      <div className={cn(
        'rounded-lg border bg-card p-4 space-y-3 transition-all',
        isContacted ? 'opacity-70 border-border' : 'border-border card-interactive',
      )}>
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <p className="font-medium text-sm truncate">{opp.event_title}</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3 shrink-0" />
              <span>{formatDate(opp.event_date)}</span>
              <span className="text-primary font-medium">· em {days}d</span>
            </div>
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
            <span className="font-medium">{opp.contact_name}</span>
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

        {/* Missing categories chips */}
        {opp.missing_categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] text-muted-foreground mr-0.5">Falta:</span>
            {opp.missing_categories.map((cat) => (
              <span
                key={cat}
                className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border border-primary/30 bg-primary/5 text-primary"
              >
                + {cat}
              </span>
            ))}
          </div>
        )}

        {/* Action row */}
        <div className="flex items-center gap-2 pt-0.5">
          {!isContacted ? (
            <Button
              size="sm"
              className="h-7 text-xs flex-1"
              onClick={() => setContactOpen(true)}
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
                  onClick={() => setReopenLogId(opp.log_id)}
                >
                  <RotateCcw className="w-3 h-3 mr-1" /> Reabrir
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <ContactDialog
        opportunity={contactOpen ? opp : null}
        onClose={() => setContactOpen(false)}
      />
      <ReopenDialog
        logId={reopenLogId}
        onClose={() => setReopenLogId(null)}
      />
    </>
  )
}
