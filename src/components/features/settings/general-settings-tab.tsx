'use client'

import { useState } from 'react'
import { Loader2, Globe, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useUnitStore } from '@/stores/unit-store'
import { useUnitSettings, useUpdateUnitSettings } from '@/hooks/use-unit-settings'
import type { UnitSettingsData } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// OPÇÕES
// ─────────────────────────────────────────────────────────────

const TIMEZONES = [
  { value: 'America/Sao_Paulo',   label: 'Brasília / São Paulo (UTC-3)' },
  { value: 'America/Manaus',      label: 'Manaus (UTC-4)' },
  { value: 'America/Belem',       label: 'Belém / Fortaleza (UTC-3)' },
  { value: 'America/Recife',      label: 'Recife (UTC-3)' },
  { value: 'America/Bahia',       label: 'Salvador (UTC-3)' },
  { value: 'America/Cuiaba',      label: 'Cuiabá (UTC-4)' },
  { value: 'America/Porto_Velho', label: 'Porto Velho (UTC-4)' },
  { value: 'America/Boa_Vista',   label: 'Boa Vista (UTC-4)' },
  { value: 'America/Rio_Branco',  label: 'Rio Branco (UTC-5)' },
  { value: 'America/Noronha',     label: 'Fernando de Noronha (UTC-2)' },
]

const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (padrão BR)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (EUA)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO 8601)' },
]

// ─────────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────────

export function GeneralSettingsTab() {
  const { activeUnit } = useUnitStore()
  const { data: settingsRow, isLoading } = useUnitSettings()
  const update = useUpdateUnitSettings()

  const existing = settingsRow?.settings ?? {}

  const [timezone,   setTimezone]   = useState(existing.timezone   ?? 'America/Sao_Paulo')
  const [dateFormat, setDateFormat] = useState(existing.date_format ?? 'DD/MM/YYYY')

  // Sync state when data loads
  const [synced, setSynced] = useState(false)
  if (!synced && settingsRow) {
    setTimezone(settingsRow.settings.timezone   ?? 'America/Sao_Paulo')
    setDateFormat(settingsRow.settings.date_format ?? 'DD/MM/YYYY')
    setSynced(true)
  }

  async function handleSave() {
    const merged: UnitSettingsData = {
      ...existing,
      timezone,
      date_format: dateFormat,
    }
    await update.mutateAsync(merged)
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-12 bg-muted rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-lg">
      {/* Unidade (readonly) */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          Unidade
        </h3>
        <Separator />
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Nome da unidade</Label>
          <p className="text-sm font-medium text-foreground bg-muted/50 rounded-lg px-3 py-2 border border-border">
            {activeUnit?.name ?? '—'}
          </p>
          <p className="text-xs text-muted-foreground">
            Para alterar o nome da unidade, acesse <strong>Admin → Unidades</strong>.
          </p>
        </div>
      </section>

      {/* Localização */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Globe className="w-4 h-4" />
          Localização e Formato
        </h3>
        <Separator />

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Fuso horário</Label>
            <Select value={timezone} onValueChange={(v: string | null) => setTimezone(v ?? 'America/Sao_Paulo')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Formato de data</Label>
            <Select value={dateFormat} onValueChange={(v: string | null) => setDateFormat(v ?? 'DD/MM/YYYY')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <Button onClick={handleSave} disabled={update.isPending}>
        {update.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Salvar configurações
      </Button>
    </div>
  )
}
