'use client'

import { cn } from '@/lib/utils'
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select'
import type { TeamTaskFilters, CommercialTaskStatus, CommercialTaskPriority } from '@/hooks/commercial-checklist/use-commercial-tasks'

// ── My Tasks filter pills ─────────────────────────────────────

export type MyFilter = 'today' | 'overdue' | 'upcoming_7d' | 'all'

interface MyTaskFilterPillsProps {
  value:    MyFilter
  onChange: (v: MyFilter) => void
  counts?:  Partial<Record<MyFilter, number>>
}

const MY_FILTER_OPTIONS: { value: MyFilter; label: string }[] = [
  { value: 'today',       label: 'Hoje' },
  { value: 'overdue',     label: 'Atrasadas' },
  { value: 'upcoming_7d', label: 'Próximos 7 dias' },
  { value: 'all',         label: 'Todas' },
]

export function MyTaskFilterPills({ value, onChange, counts }: MyTaskFilterPillsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {MY_FILTER_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
            value === opt.value
              ? 'bg-brand-600 text-white'
              : 'bg-surface-secondary text-text-secondary hover:bg-surface-tertiary',
          )}
        >
          {opt.label}
          {counts?.[opt.value] !== undefined && (
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-xs font-semibold',
              value === opt.value ? 'bg-white/20 text-white' : 'bg-surface-tertiary text-text-primary',
            )}>
              {counts[opt.value]}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ── Team task filters ─────────────────────────────────────────

interface TeamTaskFiltersBarProps {
  filters:   TeamTaskFilters
  onChange:  (filters: TeamTaskFilters) => void
  assignees?: { id: string; name: string }[]
}

export function TeamTaskFiltersBar({ filters, onChange, assignees }: TeamTaskFiltersBarProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {/* Vendedora */}
      {assignees && assignees.length > 0 && (
        <Select
          value={filters.assigneeId ?? ''}
          onValueChange={(v) => onChange({ ...filters, assigneeId: v || undefined })}
        >
          <SelectTrigger className="w-44">
            <span data-slot="select-value">
              {filters.assigneeId
                ? (assignees.find((a) => a.id === filters.assigneeId)?.name ?? 'Vendedora')
                : 'Todas as vendedoras'}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas as vendedoras</SelectItem>
            {assignees.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Status */}
      <Select
        value={filters.status ?? ''}
        onValueChange={(v) => onChange({ ...filters, status: (v as CommercialTaskStatus) || '' })}
      >
        <SelectTrigger className="w-40">
          <span data-slot="select-value">
            {filters.status === 'pending'     ? 'Pendente'
            : filters.status === 'in_progress' ? 'Em andamento'
            : filters.status === 'completed'   ? 'Concluída'
            : filters.status === 'cancelled'   ? 'Cancelada'
            : 'Todos os status'}
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Todos os status</SelectItem>
          <SelectItem value="pending">Pendente</SelectItem>
          <SelectItem value="in_progress">Em andamento</SelectItem>
          <SelectItem value="completed">Concluída</SelectItem>
          <SelectItem value="cancelled">Cancelada</SelectItem>
        </SelectContent>
      </Select>

      {/* Prioridade */}
      <Select
        value={filters.priority ?? ''}
        onValueChange={(v) => onChange({ ...filters, priority: (v as CommercialTaskPriority) || '' })}
      >
        <SelectTrigger className="w-36">
          <span data-slot="select-value">
            {filters.priority === 'low'    ? 'Baixa'
            : filters.priority === 'medium' ? 'Média'
            : filters.priority === 'high'   ? 'Alta'
            : 'Todas as prioridades'}
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Todas as prioridades</SelectItem>
          <SelectItem value="low">Baixa</SelectItem>
          <SelectItem value="medium">Média</SelectItem>
          <SelectItem value="high">Alta</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
