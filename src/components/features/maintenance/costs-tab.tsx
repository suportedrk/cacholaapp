'use client'

import { useState } from 'react'
import { DollarSign, Plus, TrendingUp, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FilterChip } from '@/components/shared/filter-chip'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/shared/empty-state'
import { CostCard, CostCardSkeleton } from './cost-card'
import { CostFormModal } from './cost-form-modal'
import {
  useMaintCosts, useCostsSummary, useCurrentUser,
  COST_TYPE_LABELS, PERIOD_OPTIONS, MANAGER_ROLES, formatBRL,
  type CostFilters,
} from '@/hooks/use-maintenance-costs'
import type { MaintenanceCostStatus, MaintenanceCostType } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// SUMMARY KPI CARD
// ─────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, color,
}: {
  label: string
  value: string | number
  sub?: string
  color?: 'amber' | 'green' | 'default'
}) {
  const colorMap = {
    amber:   'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
    green:   'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800',
    default: 'bg-card border-border',
  }
  const valueColorMap = {
    amber:   'text-amber-700 dark:text-amber-400',
    green:   'text-green-700 dark:text-green-400',
    default: 'text-foreground',
  }
  const c = color ?? 'default'

  return (
    <div className={`rounded-xl border p-3 text-center ${colorMap[c]}`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-lg font-bold leading-tight ${valueColorMap[c]}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// COSTS TAB
// ─────────────────────────────────────────────────────────────
const STATUS_CHIPS: { value: MaintenanceCostStatus; label: string; color: 'amber' | 'green' | 'red' }[] = [
  { value: 'pending',  label: 'Pendente',  color: 'amber' },
  { value: 'approved', label: 'Aprovado',  color: 'green' },
  { value: 'rejected', label: 'Reprovado', color: 'red'   },
]

const TYPE_CHIPS = Object.entries(COST_TYPE_LABELS) as [MaintenanceCostType, string][]

export function CostsTab() {
  const [formOpen, setFormOpen] = useState(false)
  const [filters, setFilters]   = useState<CostFilters>({ period: 'this_month' })

  const { data: costs = [], isLoading, isError } = useMaintCosts(filters)
  const { data: summary }                         = useCostsSummary()
  const { data: currentUser }                     = useCurrentUser()

  const currentUserId = currentUser?.id ?? null
  const canApprove    = !!currentUser && (MANAGER_ROLES as readonly string[]).includes(currentUser.role)

  // Toggle helpers
  function toggleStatus(s: MaintenanceCostStatus) {
    setFilters((f) => {
      const prev = f.status ?? []
      const next = prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
      return { ...f, status: next.length ? next : undefined }
    })
  }

  function toggleType(t: MaintenanceCostType) {
    setFilters((f) => {
      const prev = f.cost_type ?? []
      const next = prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
      return { ...f, cost_type: next.length ? next : undefined }
    })
  }

  return (
    <div className="space-y-5">
      {/* ── KPI Summary ─────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard
          label="Pendentes"
          value={summary?.pendingCount ?? '—'}
          sub="aguardando"
          color="amber"
        />
        <KpiCard
          label="Aprovados (mês)"
          value={summary ? formatBRL(summary.approvedSum) : '—'}
          color="green"
        />
        <KpiCard
          label="Total (mês)"
          value={summary ? formatBRL(summary.totalSum) : '—'}
        />
      </div>

      {/* ── Header: action button ────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-foreground">Lançamentos</h3>
        <Button size="sm" className="gap-1.5" onClick={() => setFormOpen(true)}>
          <Plus className="w-4 h-4" />
          Registrar Custo
        </Button>
      </div>

      {/* ── Filters ─────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Period */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">Período:</span>
          <Select
            value={filters.period ?? 'this_month'}
            onValueChange={(v) => setFilters((f) => ({ ...f, period: (v ?? 'this_month') as CostFilters['period'] }))}
          >
            <SelectTrigger className="h-8 text-xs w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Status:</span>
          {STATUS_CHIPS.map(({ value, label, color }) => (
            <FilterChip
              key={value}
              label={label}
              color={color}
              active={(filters.status ?? []).includes(value)}
              onClick={() => toggleStatus(value)}
            />
          ))}
        </div>

        {/* Type chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Tipo:</span>
          {TYPE_CHIPS.map(([value, label]) => (
            <FilterChip
              key={value}
              label={label}
              color="gray"
              active={(filters.cost_type ?? []).includes(value)}
              onClick={() => toggleType(value)}
            />
          ))}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────── */}
      {isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive text-center">
          Erro ao carregar custos. Tente recarregar a página.
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <CostCardSkeleton key={i} />)}
        </div>
      ) : costs.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="Nenhum custo registrado"
          description="Registre os gastos de manutenção para acompanhar os custos e submeter para aprovação."
          action={{ label: 'Registrar Custo', onClick: () => setFormOpen(true) }}
        />
      ) : (
        <div className="space-y-3">
          {costs.map((cost) => (
            <CostCard
              key={cost.id}
              cost={cost}
              currentUserId={currentUserId}
              canApprove={canApprove}
            />
          ))}
        </div>
      )}

      {/* ── Form Modal ──────────────────────────────────────── */}
      <CostFormModal open={formOpen} onOpenChange={setFormOpen} />
    </div>
  )
}
