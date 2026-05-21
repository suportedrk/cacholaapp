'use client'

import { cn } from '@/lib/utils'
import { Building2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import type { UserUnitWithUnit } from '@/types/database.types'

/**
 * Banner que aparece nas telas de Configuração de Manutenção quando o seletor
 * global está em "Todas as unidades". Força o usuário a escolher uma unidade
 * antes de criar/editar setores, categorias, itens ou SLAs.
 *
 * Renderize SOMENTE quando `requiresUnitSelection === true`. Quando `false`,
 * a tela já está escopada à unidade do store.
 */
interface UnitPickerBannerProps {
  value:        string
  onChange:     (unitId: string) => void
  units:        UserUnitWithUnit[]
  /** Texto do contexto exibido no banner (ex.: "criar setores", "criar categorias") */
  contextLabel: string
}

export function UnitPickerBanner({ value, onChange, units, contextLabel }: UnitPickerBannerProps) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border',
        value
          ? 'bg-card border-border'
          : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
      )}
    >
      <div className="flex items-start gap-2 flex-1">
        <Building2 className={cn('w-4 h-4 mt-0.5 shrink-0', value ? 'text-primary' : 'text-amber-600')} />
        <div className="text-sm">
          <p className={cn('font-medium', value ? 'text-text-primary' : 'text-amber-700 dark:text-amber-400')}>
            {value
              ? 'Visualizando configurações por unidade'
              : `Selecione a unidade para ${contextLabel}`}
          </p>
          <p className="text-xs text-text-tertiary mt-0.5">
            Seletor global está em &quot;Todas as unidades&quot;. Cada configuração pertence a uma única unidade.
          </p>
        </div>
      </div>

      <div className="w-full sm:w-64 shrink-0">
        <Select
          value={value || 'none'}
          onValueChange={(v) => onChange(v === 'none' ? '' : (v ?? ''))}
        >
          <SelectTrigger className="w-full">
            <span data-slot="select-value">
              {value
                ? (units.find((u) => u.unit_id === value)?.unit?.name ?? 'Selecionar...')
                : 'Selecionar unidade...'}
            </span>
          </SelectTrigger>
          <SelectContent>
            {units.length === 0 && (
              <SelectItem value="none" disabled>Sem unidades disponíveis</SelectItem>
            )}
            {units.map((u) => (
              <SelectItem key={u.unit_id} value={u.unit_id}>{u.unit?.name ?? u.unit_id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
