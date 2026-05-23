'use client'

import { useState, useMemo } from 'react'
import { Search, CalendarDays, AlertTriangle, Loader2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useEventsForLink, useOSCountForEvent } from '@/hooks/use-decoracao-os'
import type { EventSummaryForOS } from '@/types/decoracao'

// ── helpers ─────────────────────────────────────────────────────

function formatDate(d: string) {
  // YYYY-MM-DD → DD/MM/AAAA
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function formatTime(t: string) {
  // HH:MM:SS → HH:MM
  return t.slice(0, 5)
}

// ── EventCard ────────────────────────────────────────────────────

function EventCard({
  event,
  onSelect,
}: {
  event: EventSummaryForOS
  onSelect: (e: EventSummaryForOS) => void
}) {
  const { data: osCount = 0, isLoading } = useOSCountForEvent(event.id)
  const hasExistingOS = !isLoading && osCount > 0

  return (
    <button
      type="button"
      onClick={() => onSelect(event)}
      className="w-full rounded-lg border border-border-default bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium leading-tight">{event.client_name}</span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {formatDate(event.date)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {event.birthday_person && (
            <span>
              🎂 {event.birthday_person}
            </span>
          )}
          {event.theme && <span>🎨 {event.theme}</span>}
          <span>
            {formatTime(event.start_time)} – {formatTime(event.end_time)}
          </span>
          {event.unit_slug && (
            <span className="uppercase tracking-wide text-[10px] font-medium text-brand-600">
              {event.unit_slug}
            </span>
          )}
        </div>

        {hasExistingOS && (
          <div className="mt-1 flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            Essa festa já tem{' '}
            {osCount === 1 ? 'uma ordem de serviço' : `${osCount} ordens de serviço`} — deseja
            criar outra?
          </div>
        )}
      </div>
    </button>
  )
}

// ── EventLinkSheet ────────────────────────────────────────────────

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** Chamado com a festa selecionada. */
  onSelect: (event: EventSummaryForOS) => void
}

export function EventLinkSheet({ open, onOpenChange, onSelect }: Props) {
  const [search, setSearch] = useState('')

  const { data: events = [], isLoading } = useEventsForLink({ search })

  const results = useMemo(() => {
    // A RPC já filtra; aqui apenas garantimos a lista
    return events
  }, [events])

  function handleSelect(event: EventSummaryForOS) {
    onSelect(event)
    onOpenChange(false)
    setSearch('')
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border-default px-4 py-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4" />
            Vincular festa
          </SheetTitle>
          <SheetDescription className="text-xs">
            Festas dos últimos 30 dias até 90 dias à frente. Ao vincular, data, hora e unidade são
            copiadas da festa.
          </SheetDescription>
        </SheetHeader>

        {/* Busca */}
        <div className="border-b border-border-default px-4 py-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, aniversariante ou tema…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
              autoFocus
            />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando festas…
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <CalendarDays className="h-8 w-8 opacity-40" />
              <p>Nenhuma festa encontrada nessa janela.</p>
              {search && (
                <Button variant="ghost" size="sm" onClick={() => setSearch('')}>
                  Limpar busca
                </Button>
              )}
            </div>
          ) : (
            <ul className="flex flex-col gap-2 p-4">
              {results.map((ev) => (
                <li key={ev.id}>
                  <EventCard event={ev} onSelect={handleSelect} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
