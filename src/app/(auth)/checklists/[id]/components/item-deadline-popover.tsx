'use client'

import { useState } from 'react'
import { addDays, format, parseISO, startOfToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarDays, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface ItemDeadlinePopoverProps {
  open: boolean
  onClose: () => void
  currentDueAt?: string | null
  onSetDeadline: (dueAt: string | null) => void
}

const PRESETS = [
  { label: 'Hoje',      days: 0 },
  { label: 'Amanhã',    days: 1 },
  { label: 'Em 3 dias', days: 3 },
  { label: '1 semana',  days: 7 },
]

function toLocalDateStr(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

function formatDisplay(iso: string): string {
  try {
    return format(parseISO(iso), "d 'de' MMM", { locale: ptBR })
  } catch {
    return iso
  }
}

export function ItemDeadlinePopover({
  open,
  onClose,
  currentDueAt,
  onSetDeadline,
}: ItemDeadlinePopoverProps) {
  const today = startOfToday()
  const [dateValue, setDateValue] = useState(currentDueAt?.slice(0, 10) ?? '')

  function handlePreset(days: number) {
    const d = addDays(today, days)
    onSetDeadline(toLocalDateStr(d))
    onClose()
  }

  function handleCustom(val: string) {
    setDateValue(val)
    if (val) {
      onSetDeadline(val)
      onClose()
    }
  }

  function handleRemove() {
    onSetDeadline(null)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => { if (!isOpen) onClose() }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-w-xs p-0 gap-0 overflow-hidden"
      >
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-sm flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            Definir prazo
          </DialogTitle>
        </DialogHeader>

        {/* Presets */}
        <div className="p-4 pb-3 grid grid-cols-2 gap-2">
          {PRESETS.map((p) => {
            const val = toLocalDateStr(addDays(today, p.days))
            const isActive = currentDueAt?.slice(0, 10) === val
            return (
              <button
                key={p.days}
                onClick={() => handlePreset(p.days)}
                className={cn(
                  'h-9 rounded-lg text-sm font-medium border transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-border hover:bg-muted/60',
                )}
              >
                {p.label}
              </button>
            )
          })}
        </div>

        {/* Custom date */}
        <div className="px-4 pb-3 border-t border-border pt-3">
          <label className="block text-xs text-muted-foreground mb-1.5">
            Ou escolha uma data
          </label>
          <input
            type="date"
            value={dateValue}
            min={toLocalDateStr(today)}
            onChange={(e) => handleCustom(e.target.value)}
            className="w-full h-9 px-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Remove */}
        {currentDueAt && (
          <div className="px-4 pb-4 border-t border-border pt-3">
            <button
              onClick={handleRemove}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              Remover prazo
              {currentDueAt && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatDisplay(currentDueAt)}
                </span>
              )}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
