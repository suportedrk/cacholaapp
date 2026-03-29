'use client'

import { CheckCircle2 } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { MaintenanceStatus } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────
const STATUS_OPTIONS: {
  value: MaintenanceStatus
  label: string
  idle: string
  active: string
}[] = [
  {
    value:  'open',
    label:  'Aberta',
    idle:   'bg-primary/10 border-primary/30 text-primary dark:bg-primary/20',
    active: 'bg-primary border-primary text-primary-foreground',
  },
  {
    value:  'in_progress',
    label:  'Em Andamento',
    idle:   'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300',
    active: 'bg-amber-500 border-amber-500 text-white',
  },
  {
    value:  'waiting_parts',
    label:  'Aguard. Peças',
    idle:   'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950/30 dark:border-purple-800 dark:text-purple-300',
    active: 'bg-purple-500 border-purple-500 text-white',
  },
  {
    value:  'completed',
    label:  'Concluída',
    idle:   'bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300',
    active: 'bg-green-500 border-green-500 text-white',
  },
]

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
interface Props {
  open:          boolean
  onOpenChange:  (v: boolean) => void
  currentStatus: MaintenanceStatus
  onSelect:      (status: MaintenanceStatus) => void
}

export function StatusBottomSheet({ open, onOpenChange, currentStatus, onSelect }: Props) {
  function handleSelect(status: MaintenanceStatus) {
    onSelect(status)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl"
      >
        <SheetHeader>
          <SheetTitle>Alterar Status</SheetTitle>
        </SheetHeader>

        {/* 2×2 grid */}
        <div className="grid grid-cols-2 gap-3 px-4 pb-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          {STATUS_OPTIONS.map((opt) => {
            const isActive = currentStatus === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                disabled={isActive}
                onClick={() => handleSelect(opt.value)}
                className={cn(
                  'flex items-center justify-center gap-2',
                  'h-14 rounded-xl border-2 text-sm font-semibold',
                  'transition-all active:scale-95',
                  'disabled:cursor-default',
                  isActive ? opt.active : opt.idle,
                )}
              >
                {isActive && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                {opt.label}
              </button>
            )
          })}
        </div>
      </SheetContent>
    </Sheet>
  )
}
