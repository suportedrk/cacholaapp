'use client'

import { useEffect, useRef, useState } from 'react'
import { Target, Pencil, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useSellers } from '@/hooks/use-sellers'
import { useSalesTarget, useSetSalesTarget } from '@/hooks/use-vendas-targets'

function formatCurrency(v: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
  }).format(v)
}

/** Mês atual no formato AAAA-MM (input type="month"). */
function currentMonthValue(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** Nº de meses-calendário no intervalo [start, end] inclusive (ISO YYYY-MM-DD). */
function monthsInPeriod(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00`)
  const e = new Date(`${end}T00:00:00`)
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 1
  return Math.max(1, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1)
}

interface Props {
  realizado:  number
  sellerId:   string | null
  startDate:  string
  endDate:    string
  canManage:  boolean
}

export function MetaCard({ realizado, sellerId, startDate, endDate, canManage }: Props) {
  const { data: target, isLoading, isError } = useSalesTarget({ sellerId, startDate, endDate })
  const [dialogOpen, setDialogOpen] = useState(false)

  const meta = target?.target_revenue ?? 0
  const hasMeta = meta > 0
  const pct = hasMeta ? Math.round((realizado / meta) * 100) : 0
  const barWidth = Math.min(pct, 100)
  const reached = hasMeta && realizado >= meta

  // Sinaliza meta parcial: período com mais meses do que os que têm meta cadastrada
  // (a meta exibida é a SOMA das metas mensais do intervalo → % fica fora de escala
  // se só parte dos meses tem meta). Mês único (pills "mês atual/anterior") não alerta.
  const periodMonths = monthsInPeriod(startDate, endDate)
  const monthsWithMeta = target?.months_count ?? 0
  const isPartial = hasMeta && periodMonths > 1 && monthsWithMeta < periodMonths

  return (
    <div className="bg-card rounded-xl border border-border-default p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="icon-amber rounded-md p-1.5">
            <Target className="w-4 h-4" />
          </span>
          <span className="text-sm font-medium text-text-primary">Meta do período</span>
        </div>
        {canManage && (
          <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Definir meta
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="skeleton-shimmer h-5 w-40 rounded" />
          <Skeleton className="skeleton-shimmer h-2.5 w-full rounded-full" />
        </div>
      ) : isError ? (
        <p className="text-xs text-status-error-text">
          Não foi possível carregar a meta.
        </p>
      ) : !hasMeta ? (
        <p className="text-xs text-text-tertiary">
          Meta não definida para este período.
          {canManage && ' Use “Definir meta” para cadastrar.'}
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm text-text-secondary">
              {formatCurrency(realizado)} <span className="text-text-tertiary">de</span>{' '}
              {formatCurrency(meta)}
            </span>
            <span
              className={cn(
                'text-sm font-semibold tabular-nums',
                reached ? 'text-status-success-text' : 'text-text-primary',
              )}
            >
              {pct}%
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-surface-secondary overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                reached ? 'bg-status-success-text' : 'bg-[var(--primary)]',
              )}
              style={{ width: `${barWidth}%` }}
            />
          </div>
          {periodMonths > 1 && (
            <p className={cn('text-xs', isPartial ? 'text-status-warning-text' : 'text-text-tertiary')}>
              {isPartial
                ? `Meta parcial: ${monthsWithMeta} de ${periodMonths} meses do período têm meta cadastrada.`
                : `Soma das metas dos ${periodMonths} meses do período.`}
            </p>
          )}
        </div>
      )}

      {canManage && (
        <MetaDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          initialSellerId={sellerId}
        />
      )}
    </div>
  )
}

// ── Dialog "Definir meta" ─────────────────────────────────────

interface DialogProps {
  open:            boolean
  onOpenChange:    (open: boolean) => void
  initialSellerId: string | null
}

function MetaDialog({ open, onOpenChange, initialSellerId }: DialogProps) {
  const { data: sellers = [] } = useSellers()
  const setTarget = useSetSalesTarget()

  const activeSellers = sellers.filter((s) => s.status === 'active' && !s.is_system_account)

  const [sellerId, setSellerId] = useState<string>('')
  const [month, setMonth]       = useState<string>(currentMonthValue())
  const [revenue, setRevenue]   = useState<string>('')
  const prefillKey = useRef('')

  // Reset ao abrir; pré-seleciona a vendedora do contexto do painel se houver.
  // Zera prefillKey para que o prefill reaplique mesmo reabrindo no mesmo (seller, mês).
  useEffect(() => {
    if (open) {
      prefillKey.current = ''
      /* eslint-disable react-hooks/set-state-in-effect */
      setSellerId(initialSellerId ?? '')
      setMonth(currentMonthValue())
      setRevenue('')
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [open, initialSellerId])

  // Pré-preenche o valor com a meta já existente do mês/vendedora escolhidos.
  const monthDate = month ? `${month}-01` : ''
  const prefill = useSalesTarget({
    sellerId: sellerId || null,
    startDate: monthDate,
    endDate: monthDate,
    enabled: open && !!sellerId && !!month,
  })
  useEffect(() => {
    const key = `${sellerId}|${month}`
    if (open && sellerId && month && prefill.data && !prefill.isFetching && prefillKey.current !== key) {
      prefillKey.current = key
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRevenue(prefill.data.target_revenue ? String(prefill.data.target_revenue) : '')
    }
  }, [open, sellerId, month, prefill.data, prefill.isFetching])

  function handleSave() {
    const value = Number(revenue)
    if (!sellerId || !month || !Number.isFinite(value) || value < 0) return
    setTarget.mutate(
      { sellerId, periodMonth: month, targetRevenue: value },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!setTarget.isPending) onOpenChange(o) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Definir meta de faturamento</DialogTitle>
          <DialogDescription>
            Meta mensal por vendedora. Salvar substitui a meta do mês escolhido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="meta-seller">Vendedora</Label>
            <Select value={sellerId} onValueChange={(v) => setSellerId(v ?? '')}>
              <SelectTrigger id="meta-seller" className="w-full">
                <SelectValue>
                  {sellerId
                    ? (activeSellers.find((s) => s.id === sellerId)?.name ?? 'Selecione')
                    : 'Selecione a vendedora'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {activeSellers.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-text-tertiary">
                    Nenhuma vendedora ativa.
                  </div>
                ) : (
                  activeSellers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="meta-month">Mês</Label>
            <Input
              id="meta-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="meta-revenue">Meta de faturamento (R$)</Label>
            <Input
              id="meta-revenue"
              type="number"
              min={0}
              step={1000}
              inputMode="numeric"
              placeholder="Ex: 50000"
              value={revenue}
              onChange={(e) => setRevenue(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={setTarget.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={setTarget.isPending || !sellerId || !month || revenue === ''}
          >
            {setTarget.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
