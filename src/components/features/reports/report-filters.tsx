'use client'

import { useState } from 'react'
import { format, subDays, subMonths, subQuarters, subYears, startOfMonth, endOfMonth } from 'date-fns'
import { CalendarIcon, ChevronDown } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import type { ReportFilters } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// PRESETS
// ─────────────────────────────────────────────────────────────

type Preset = { label: string; from: Date; to: Date }

function getPresets(): Preset[] {
  const today = new Date()
  return [
    { label: 'Última semana',    from: subDays(today, 7),      to: today },
    { label: 'Último mês',       from: subMonths(today, 1),    to: today },
    { label: 'Último trimestre', from: subQuarters(today, 1),  to: today },
    { label: 'Último ano',       from: subYears(today, 1),     to: today },
    {
      label: 'Este mês',
      from: startOfMonth(today),
      to:   endOfMonth(today),
    },
  ]
}

const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

// ─────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────

type ReportFiltersBarProps = {
  value:    ReportFilters
  onChange: (f: ReportFilters) => void
  disabled?: boolean
}

// ─────────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────────

export function ReportFiltersBar({ value, onChange, disabled }: ReportFiltersBarProps) {
  const [activePreset, setActivePreset] = useState<string | null>('Último mês')
  const presets = getPresets()

  function applyPreset(p: Preset) {
    setActivePreset(p.label)
    onChange({ ...value, from: fmt(p.from), to: fmt(p.to) })
  }

  function handleFrom(e: React.ChangeEvent<HTMLInputElement>) {
    setActivePreset(null)
    onChange({ ...value, from: e.target.value })
  }

  function handleTo(e: React.ChangeEvent<HTMLInputElement>) {
    setActivePreset(null)
    onChange({ ...value, to: e.target.value })
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
      {/* Presets */}
      <div className="flex items-center gap-1 flex-wrap">
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={disabled}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-9 gap-1.5')}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>{activePreset ?? 'Personalizado'}</span>
            <ChevronDown className="w-3 h-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            {presets.map((p) => (
              <DropdownMenuItem
                key={p.label}
                onClick={() => applyPreset(p)}
                className="cursor-pointer"
              >
                {p.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Date range inputs */}
      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">De</Label>
          <Input
            type="date"
            value={value.from}
            onChange={handleFrom}
            disabled={disabled}
            className="h-9 w-38 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Até</Label>
          <Input
            type="date"
            value={value.to}
            onChange={handleTo}
            disabled={disabled}
            className="h-9 w-38 text-sm"
          />
        </div>
      </div>
    </div>
  )
}
