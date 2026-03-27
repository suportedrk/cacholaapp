'use client'

import { useState } from 'react'
import { Loader2, Clock, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  useUnitSettings,
  useUpdateUnitSettings,
  DEFAULT_UNIT_SETTINGS,
} from '@/hooks/use-unit-settings'
import type { BusinessHourDay, UnitSettingsData } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────

const DAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const DAY_SHORT  = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────

export function BusinessHoursTab() {
  const { data: settingsRow, isLoading } = useUnitSettings()
  const update = useUpdateUnitSettings()

  const existing = settingsRow?.settings ?? {}

  // Horários por dia da semana
  const [hours, setHours] = useState<Record<string, BusinessHourDay>>(() => {
    const defaults = DEFAULT_UNIT_SETTINGS.business_hours!
    const saved    = existing.business_hours ?? {}
    return Object.fromEntries(
      [0, 1, 2, 3, 4, 5, 6].map((d) => [
        String(d),
        { ...defaults[String(d)], ...saved[String(d)] },
      ])
    )
  })

  // Sync quando os dados carregam
  const [synced, setSynced] = useState(false)
  /* eslint-disable react-hooks/set-state-in-effect */
  if (!synced && settingsRow) {
    const defaults = DEFAULT_UNIT_SETTINGS.business_hours!
    const saved    = settingsRow.settings.business_hours ?? {}
    setHours(
      Object.fromEntries(
        [0, 1, 2, 3, 4, 5, 6].map((d) => [
          String(d),
          { ...defaults[String(d)], ...saved[String(d)] },
        ])
      )
    )
    setSynced(true)
  }
  /* eslint-enable react-hooks/set-state-in-effect */

  // Padrões de evento
  const defaultEvt = DEFAULT_UNIT_SETTINGS.event_defaults!
  const savedEvt   = existing.event_defaults ?? {}

  const [durationHours, setDurationHours] = useState(
    String(savedEvt.default_duration_hours ?? defaultEvt.default_duration_hours)
  )
  const [gapHours, setGapHours] = useState(
    String(savedEvt.min_gap_hours ?? defaultEvt.min_gap_hours)
  )
  const [startTime, setStartTime] = useState(
    savedEvt.default_start_time ?? defaultEvt.default_start_time ?? '14:00'
  )

  function setDay(dayIdx: number, patch: Partial<BusinessHourDay>) {
    setHours((prev) => ({
      ...prev,
      [String(dayIdx)]: { ...prev[String(dayIdx)], ...patch },
    }))
  }

  async function handleSave() {
    const merged: UnitSettingsData = {
      ...existing,
      business_hours: hours,
      event_defaults: {
        default_duration_hours: Number(durationHours) || 4,
        min_gap_hours:          Number(gapHours)       || 1,
        default_start_time:     startTime,
      },
    }
    await update.mutateAsync(merged)
  }

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="h-12 bg-muted rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-lg">

      {/* ── Horários por dia ─────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Horários de Funcionamento
        </h3>
        <Separator />
        <p className="text-xs text-muted-foreground">
          Define os horários disponíveis para agendamento de eventos.
        </p>

        <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
          {[0, 1, 2, 3, 4, 5, 6].map((d) => {
            const day = hours[String(d)]
            return (
              <div
                key={d}
                className={`flex items-center gap-3 px-4 py-3 bg-card transition-colors ${
                  !day.enabled ? 'opacity-50' : ''
                }`}
              >
                {/* Toggle + nome */}
                <Switch
                  checked={day.enabled}
                  onCheckedChange={(v) => setDay(d, { enabled: v })}
                  aria-label={DAY_LABELS[d]}
                />
                <span className="text-sm font-medium text-foreground w-14 shrink-0">
                  <span className="hidden sm:inline">{DAY_LABELS[d]}</span>
                  <span className="sm:hidden">{DAY_SHORT[d]}</span>
                </span>

                {day.enabled ? (
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs text-muted-foreground shrink-0">das</span>
                    <Input
                      type="time"
                      value={day.open}
                      onChange={(e) => setDay(d, { open: e.target.value })}
                      className="h-8 text-xs w-28"
                    />
                    <span className="text-xs text-muted-foreground shrink-0">às</span>
                    <Input
                      type="time"
                      value={day.close}
                      onChange={(e) => setDay(d, { close: e.target.value })}
                      className="h-8 text-xs w-28"
                    />
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic flex-1">Fechado</span>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Padrões de evento ─────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <CalendarDays className="w-4 h-4" />
          Padrões de Evento
        </h3>
        <Separator />
        <p className="text-xs text-muted-foreground">
          Valores pré-preenchidos ao criar um novo evento.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="dur">Duração padrão (horas)</Label>
            <Input
              id="dur"
              type="number"
              min={1}
              max={24}
              value={durationHours}
              onChange={(e) => setDurationHours(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gap">Intervalo mínimo (horas)</Label>
            <Input
              id="gap"
              type="number"
              min={0}
              max={24}
              value={gapHours}
              onChange={(e) => setGapHours(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="start">Horário padrão de início</Label>
            <Input
              id="start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="h-9"
            />
          </div>
        </div>
      </section>

      <Button onClick={handleSave} disabled={update.isPending}>
        {update.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Salvar horários
      </Button>
    </div>
  )
}
