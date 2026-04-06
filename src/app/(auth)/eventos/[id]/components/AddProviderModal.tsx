'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Search } from 'lucide-react'
import { formatCurrency, parseCurrency } from '@/lib/utils/providers'
import { ProviderAvatar } from '@/app/(auth)/prestadores/components/ProviderAvatar'
import { ProviderConflictAlert } from './ProviderConflictAlert'
import { useProviders } from '@/hooks/use-providers'
import { useProviderScheduleConflicts, useAddProviderToEvent } from '@/hooks/use-event-providers'
import { useDebounce } from '@/hooks/use-debounce'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  PRICE_TYPE_LABELS,
  EVENT_PROVIDER_STATUS_LABELS,
} from '@/types/providers'
import type { ServiceProviderListItem, EventProviderStatus, PriceType } from '@/types/providers'

// ─── helpers ─────────────────────────────────────────────────
function formatInputCurrency(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  const num = parseInt(digits, 10) / 100
  return formatCurrency(num)
}

// ─────────────────────────────────────────────────────────────
interface Props {
  eventId: string
  eventDate: string         // 'YYYY-MM-DD'
  existingProviderIds: string[]
  onClose: () => void
}

export function AddProviderModal({ eventId, eventDate, existingProviderIds, onClose }: Props) {
  const [search, setSearch]               = useState('')
  const [dropdownOpen, setDropdownOpen]   = useState(false)
  const [selected, setSelected]           = useState<ServiceProviderListItem | null>(null)
  const [categoryId, setCategoryId]       = useState('')
  const [status, setStatus]               = useState<EventProviderStatus>('pending')
  const [priceValue, setPriceValue]       = useState('')
  const [priceType, setPriceType]         = useState<PriceType>('per_event')
  const [arrivalTime, setArrivalTime]     = useState('')
  const [notes, setNotes]                 = useState('')

  const debouncedSearch = useDebounce(search, 200)
  const addProvider     = useAddProviderToEvent()
  const { data: allProviders = [] } = useProviders()

  // Filtered results: exclude already associated + apply search
  const filteredProviders = allProviders.filter((p) => {
    if (existingProviderIds.includes(p.id)) return false
    if (!debouncedSearch) return true
    return (
      p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (p.document_number ?? '').includes(debouncedSearch)
    )
  }).slice(0, 20)

  // Provider's available categories
  const providerCategories = selected?.services ?? []

  // Conflict check (runs after provider is selected)
  const { data: conflicts = [] } = useProviderScheduleConflicts(
    selected?.id ?? null,
    eventDate,
    eventId,
  )

  // Auto-select category when there is exactly one
  useEffect(() => {
    if (providerCategories.length === 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCategoryId(providerCategories[0].category_id)
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCategoryId('')
    }
  }, [selected?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function selectProvider(p: ServiceProviderListItem) {
    setSelected(p)
    setSearch(p.name)
    setDropdownOpen(false)
  }

  function handlePriceInput(raw: string) {
    setPriceValue(formatInputCurrency(raw))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return

    await addProvider.mutateAsync({
      event_id:     eventId,
      provider_id:  selected.id,
      unit_id:      selected.unit_id,
      category_id:  categoryId || undefined,
      status,
      agreed_price: priceValue ? parseCurrency(priceValue) : undefined,
      price_type:   priceType,
      arrival_time: arrivalTime || undefined,
      notes:        notes.trim() || undefined,
    })
    onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full sm:max-w-md bg-card rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[92svh] sm:max-h-[80svh]">

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-text-primary">Adicionar Prestador</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-text-tertiary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">

            {/* ── Combobox ── */}
            <div className="relative">
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Prestador <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  autoFocus
                  autoComplete="off"
                  placeholder="Buscar prestador..."
                  className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-ring"
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setDropdownOpen(true)
                    if (selected && e.target.value !== selected.name) setSelected(null)
                  }}
                  onFocus={() => setDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                />
              </div>

              {/* Dropdown */}
              {dropdownOpen && !selected && (
                <div className="absolute z-20 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                  {filteredProviders.length === 0 ? (
                    <div className="px-3 py-5 text-center text-sm text-text-tertiary">
                      {debouncedSearch ? 'Nenhum prestador encontrado' : 'Nenhum prestador disponível'}
                    </div>
                  ) : (
                    filteredProviders.map((p) => {
                      const mainCat = p.services?.[0]?.category?.name
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); selectProvider(p) }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/60 transition-colors text-left"
                        >
                          <ProviderAvatar name={p.name} size="sm" className="shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-primary truncate">{p.name}</p>
                            {mainCat && (
                              <p className="text-xs text-text-tertiary truncate">{mainCat}</p>
                            )}
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>

            {/* ── Fields shown after selection ── */}
            {selected && (
              <>
                {/* Conflict alert */}
                {conflicts.length > 0 && <ProviderConflictAlert conflicts={conflicts} />}

                {/* Category — only show when provider has multiple services */}
                {providerCategories.length > 1 && (
                  <div>
                    <Label className="text-xs font-medium text-text-secondary mb-1.5 block">
                      Categoria <span className="text-destructive">*</span>
                    </Label>
                    <Select value={categoryId || null} onValueChange={(v) => setCategoryId(v ?? '')}>
                      <SelectTrigger className="h-10">
                        {categoryId
                          ? <span data-slot="select-value" className="flex flex-1 text-left">{providerCategories.find((s) => s.category_id === categoryId)?.category?.name ?? categoryId}</span>
                          : <SelectValue placeholder="Selecionar categoria..." />}
                      </SelectTrigger>
                      <SelectContent>
                        {providerCategories.map((s) => (
                          <SelectItem key={s.id} value={s.category_id}>
                            {s.category?.name ?? 'Sem nome'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Status */}
                <div>
                  <Label className="text-xs font-medium text-text-secondary mb-1.5 block">
                    Status
                  </Label>
                  <Select value={status} onValueChange={(v) => v && setStatus(v as EventProviderStatus)}>
                    <SelectTrigger className="h-10">
                      <span data-slot="select-value" className="flex flex-1 text-left">
                        {EVENT_PROVIDER_STATUS_LABELS[status]}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(EVENT_PROVIDER_STATUS_LABELS) as [EventProviderStatus, string][]).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Price + type */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">
                      Valor acordado
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={priceValue}
                      onChange={(e) => handlePriceInput(e.target.value)}
                      placeholder="R$ 0,00"
                      className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-text-secondary mb-1.5 block">
                      Cobrança
                    </Label>
                    <Select value={priceType} onValueChange={(v) => v && setPriceType(v as PriceType)}>
                      <SelectTrigger className="h-10">
                        <span data-slot="select-value" className="flex flex-1 text-left">
                          {PRICE_TYPE_LABELS[priceType]}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(PRICE_TYPE_LABELS) as [PriceType, string][]).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Arrival time */}
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    Horário de chegada
                  </label>
                  <input
                    type="time"
                    value={arrivalTime}
                    onChange={(e) => setArrivalTime(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    Observações
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Instruções ou detalhes específicos..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div
            className="px-4 pb-4 pt-3 border-t border-border flex gap-3 shrink-0"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-lg border border-border text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!selected || addProvider.isPending}
              className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addProvider.isPending ? 'Adicionando...' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
