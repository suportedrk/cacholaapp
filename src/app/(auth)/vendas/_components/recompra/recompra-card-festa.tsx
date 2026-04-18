'use client'

import { useState } from 'react'
import { Mail, Phone, User, Star, CheckCircle, RotateCcw, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { RecompraContactDialog } from './recompra-contact-dialog'
import { RecompraReopenDialog } from './recompra-reopen-dialog'
import type { RecompraFestaPassadaOpp } from '@/hooks/use-recompra'

const OUTCOME_LABELS: Record<string, { label: string; cls: string }> = {
  tentou:  { label: 'Tentativa',  cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' },
  recusou: { label: 'Recusou',    cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  vendeu:  { label: 'Vendeu!',    cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
  outro:   { label: 'Outro',      cls: 'bg-muted text-muted-foreground' },
}

interface Props {
  opportunity: RecompraFestaPassadaOpp
  canRegister: boolean
}

export function RecompraCardFesta({ opportunity: opp, canRegister }: Props) {
  const [contactOpen, setContactOpen] = useState(false)
  const [reopenLogId, setReopenLogId] = useState<string | null>(null)

  const isContacted = !!opp.log_id
  const phone       = opp.contact_phones?.[0]?.PhoneNumber ?? null
  const outcome     = opp.log_outcome ? OUTCOME_LABELS[opp.log_outcome] : null

  const lastEventFormatted = new Date(opp.last_event_date + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

  return (
    <>
      <div className={cn(
        'rounded-lg border bg-card p-4 space-y-3 transition-all',
        isContacted ? 'opacity-70 border-border' : 'border-border card-interactive',
      )}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800">
              <Clock className="w-3 h-3" />
              Há {opp.months_since_event} meses
            </span>
            <p className="text-[11px] text-muted-foreground">
              Última festa: {lastEventFormatted}
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
            Deal: {opp.deal_title}
          </p>
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

      <RecompraContactDialog
        opportunity={contactOpen ? {
          contact_email:           opp.contact_email,
          contact_name:            opp.contact_name,
          aniversariante_birthday: opp.aniversariante_birthday,
          is_carteira_livre:       opp.is_carteira_livre,
        } : null}
        recompraType="festa_passada"
        onClose={() => setContactOpen(false)}
      />
      <RecompraReopenDialog
        logId={reopenLogId}
        onClose={() => setReopenLogId(null)}
      />
    </>
  )
}
