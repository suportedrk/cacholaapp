'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  RefreshCw,
  AlertCircle,
  Plus,
  Search,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/shared/page-header'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { useDecoracaoOS } from '@/hooks/use-decoracao-os'
import { useUnits } from '@/hooks/use-units'
import { ROUTES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import {
  STATUS_AGREGADO_BADGE,
  STATUS_AGREGADO_LABEL,
  calcTotalOS,
  formatBRLOuTraco,
  statusAgregado,
} from './os-helpers'
import type { DecoracaoOSStatusAgregado } from '@/types/decoracao'

type StatusKey = 'all' | DecoracaoOSStatusAgregado

const STATUS_FILTERS: { key: StatusKey; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'aguardando_prova', label: 'Aguardando prova' },
  { key: 'aprovada', label: 'Aprovadas' },
  { key: 'realizada', label: 'Realizadas' },
  { key: 'vazia', label: 'Sem itens' },
]

function ymToLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  const txt = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return txt.charAt(0).toUpperCase() + txt.slice(1)
}

function todayYM(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function shiftYM(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatDataFestaBR(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function formatHoraFesta(t: string | null): string {
  if (!t) return ''
  return t.slice(0, 5)
}

export function OrdensClient() {
  const { data: ordens = [], isLoading, isError, refetch } = useDecoracaoOS()
  const { data: units = [] } = useUnits()
  const { isTimedOut, retry } = useLoadingTimeout(isLoading)

  const [statusFilter, setStatusFilter] = useState<StatusKey>('all')
  const [monthYM, setMonthYM] = useState<string>(todayYM())
  const [unitFilter, setUnitFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const term = search.trim().toLowerCase()

  const enriched = useMemo(
    () =>
      ordens.map((o) => ({
        ...o,
        statusAgg: statusAgregado(o.itens),
        total: calcTotalOS(o.itens),
        countItens: o.itens.length,
      })),
    [ordens],
  )

  const filtered = useMemo(
    () =>
      enriched.filter((o) => {
        if (statusFilter !== 'all' && o.statusAgg !== statusFilter) return false
        if (unitFilter !== 'all' && o.unit_id !== unitFilter) return false
        if (monthYM) {
          if (!o.data_festa) return false
          if (o.data_festa.slice(0, 7) !== monthYM) return false
        }
        if (term && !o.tema.toLowerCase().includes(term)) return false
        return true
      }),
    [enriched, statusFilter, unitFilter, monthYM, term],
  )

  const unitNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of units) m.set(u.id, u.name)
    return m
  }, [units])

  // ── Loading ──────────────────────────────────────────────────
  if (isLoading && !isTimedOut) {
    return (
      <div className="space-y-6">
        <PageHeader title="Ordens de serviço" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="skeleton-shimmer h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  // ── Error / timeout ──────────────────────────────────────────
  if (isError || isTimedOut) {
    return (
      <div className="space-y-6">
        <PageHeader title="Ordens de serviço" />
        <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive">Erro ao carregar ordens de serviço.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { void retry?.(); void refetch() }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ordens de serviço"
        actions={
          <Link
            href={`${ROUTES.decoracaoOrdens}/nova`}
            className={cn(buttonVariants({ size: 'sm' }))}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Nova ordem
          </Link>
        }
      />

      {/* Filtros */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {/* Status */}
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                'rounded-full px-3 py-1 text-sm font-medium transition-colors',
                statusFilter === f.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Mês */}
        <div className="flex items-center gap-1 rounded-md border border-border-default bg-card px-1.5 py-1">
          <button
            type="button"
            onClick={() => setMonthYM(shiftYM(monthYM, -1))}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[7.5rem] text-center text-sm font-medium">
            {ymToLabel(monthYM)}
          </span>
          <button
            type="button"
            onClick={() => setMonthYM(shiftYM(monthYM, 1))}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Unidade */}
        <Select value={unitFilter} onValueChange={(v) => setUnitFilter(v ?? 'all')}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue>
              {unitFilter === 'all'
                ? 'Todas as unidades'
                : unitNameById.get(unitFilter) ?? 'Unidade'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as unidades</SelectItem>
            {units.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Busca por tema */}
        <div className="relative lg:ml-auto lg:w-64">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por tema…"
            className="pl-8"
          />
        </div>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
          <ClipboardList className="h-10 w-10 opacity-30" />
          <p className="text-sm">Nenhuma ordem encontrada para os filtros atuais.</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Tema</th>
                <th className="px-4 py-2.5 text-left font-medium">Data</th>
                <th className="hidden px-4 py-2.5 text-left font-medium sm:table-cell">Unidade</th>
                <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">Itens</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
                <th className="px-4 py-2.5 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o, idx) => (
                <tr
                  key={o.id}
                  className={cn(
                    'transition-colors hover:bg-muted/50',
                    idx < filtered.length - 1 && 'border-b',
                  )}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`${ROUTES.decoracaoOrdens}/${o.id}`}
                      className="block font-medium hover:underline"
                    >
                      {o.tema}
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {formatDataFestaBR(o.data_festa)}
                    {o.hora_festa && (
                      <span className="ml-1.5 text-xs">{formatHoraFesta(o.hora_festa)}</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    {unitNameById.get(o.unit_id) ?? '—'}
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground sm:table-cell">
                    {o.countItens}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {o.countItens === 0 ? '—' : formatBRLOuTraco(o.total)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                        STATUS_AGREGADO_BADGE[o.statusAgg],
                      )}
                    >
                      {STATUS_AGREGADO_LABEL[o.statusAgg]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
