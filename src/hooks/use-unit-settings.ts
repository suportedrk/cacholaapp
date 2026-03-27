'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useUnitStore } from '@/stores/unit-store'
import type { UnitSettings, UnitSettingsData } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// DEFAULTS
// ─────────────────────────────────────────────────────────────

const DEFAULT_BUSINESS_HOURS = Object.fromEntries(
  [0, 1, 2, 3, 4, 5, 6].map((d) => [
    String(d),
    {
      open: '08:00',
      close: '22:00',
      enabled: d >= 1 && d <= 6, // Mon–Sat enabled, Sun disabled
    },
  ])
)

export const DEFAULT_UNIT_SETTINGS: UnitSettingsData = {
  timezone:       'America/Sao_Paulo',
  date_format:    'DD/MM/YYYY',
  business_hours: DEFAULT_BUSINESS_HOURS,
  event_defaults: {
    default_duration_hours: 4,
    min_gap_hours:          1,
    default_start_time:     '14:00',
  },
}

// ─────────────────────────────────────────────────────────────
// LEITURA
// ─────────────────────────────────────────────────────────────

export function useUnitSettings() {
  const { activeUnitId } = useUnitStore()

  return useQuery({
    queryKey: ['unit-settings', activeUnitId],
    queryFn: async () => {
      if (!activeUnitId) return null
      const { data, error } = await createClient()
        .from('unit_settings')
        .select('*')
        .eq('unit_id', activeUnitId)
        .maybeSingle()
      if (error) throw error
      return data as UnitSettings | null
    },
    enabled: !!activeUnitId,
    staleTime: 5 * 60 * 1000,
  })
}

// Helper: retorna os settings com defaults aplicados
export function useUnitSettingsData(): UnitSettingsData {
  const { data } = useUnitSettings()
  if (!data) return DEFAULT_UNIT_SETTINGS
  return {
    ...DEFAULT_UNIT_SETTINGS,
    ...data.settings,
    business_hours: {
      ...DEFAULT_UNIT_SETTINGS.business_hours,
      ...data.settings.business_hours,
    },
    event_defaults: {
      ...DEFAULT_UNIT_SETTINGS.event_defaults,
      ...data.settings.event_defaults,
    },
  }
}

// ─────────────────────────────────────────────────────────────
// ATUALIZAÇÃO (upsert)
// ─────────────────────────────────────────────────────────────

export function useUpdateUnitSettings() {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()

  return useMutation({
    mutationFn: async (settings: UnitSettingsData) => {
      if (!activeUnitId) throw new Error('Nenhuma unidade selecionada')
      const { data, error } = await createClient()
        .from('unit_settings')
        .upsert(
          { unit_id: activeUnitId, settings },
          { onConflict: 'unit_id' }
        )
        .select()
        .single()
      if (error) throw error
      return data as UnitSettings
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unit-settings', activeUnitId] })
      toast.success('Configurações salvas com sucesso')
    },
    onError: (err: Error) => {
      toast.error(`Erro ao salvar configurações: ${err.message}`)
    },
  })
}
