'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'

// ── Index types ───────────────────────────────────────────────

export interface IndexEvent {
  id: string
  client_name: string
  date: string
  status: string
}

export interface IndexChecklist {
  id: string
  title: string
  status: string
}

export interface IndexMaintenance {
  id: string
  title: string
  status: string
  type: string
}

export interface IndexEquipment {
  id: string
  name: string
  category: string | null
}

export interface IndexProvider {
  id: string
  name: string
  avg_rating: number | null
}

export interface CommandPaletteIndex {
  events:      IndexEvent[]
  checklists:  IndexChecklist[]
  maintenance: IndexMaintenance[]
  equipment:   IndexEquipment[]
  providers:   IndexProvider[]
}

// ── Hook ─────────────────────────────────────────────────────

export function useCommandPaletteIndex(enabled: boolean) {
  const activeUnitId = useUnitStore((s) => s.activeUnitId)
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['cmd-palette-index', activeUnitId],
    queryFn: async (): Promise<CommandPaletteIndex> => {
      const supabase = createClient()

      const [evRes, clRes, mnRes, eqRes, prRes] = await Promise.all([
        (() => {
          let q = supabase
            .from('events')
            .select('id, client_name, date, status')
            .neq('status', 'lost')
            .order('date', { ascending: false })
            .limit(200)
          if (activeUnitId) q = q.eq('unit_id', activeUnitId)
          return q
        })(),

        (() => {
          let q = supabase
            .from('checklists')
            .select('id, title, status')
            .limit(150)
          if (activeUnitId) q = q.eq('unit_id', activeUnitId)
          return q
        })(),

        (() => {
          let q = supabase
            .from('maintenance_orders')
            .select('id, title, status, type')
            .neq('status', 'completed')
            .limit(100)
          if (activeUnitId) q = q.eq('unit_id', activeUnitId)
          return q
        })(),

        (() => {
          let q = supabase
            .from('equipment')
            .select('id, name, category')
            .neq('status', 'inactive')
            .neq('status', 'retired')
            .limit(100)
          if (activeUnitId) q = q.eq('unit_id', activeUnitId)
          return q
        })(),

        (() => {
          let q = supabase
            .from('service_providers')
            .select('id, name, avg_rating')
            .eq('status', 'active')
            .limit(150)
          if (activeUnitId) q = q.eq('unit_id', activeUnitId)
          return q
        })(),
      ])

      return {
        events:      (evRes.data  ?? []) as IndexEvent[],
        checklists:  (clRes.data  ?? []) as IndexChecklist[],
        maintenance: (mnRes.data  ?? []) as IndexMaintenance[],
        equipment:   (eqRes.data  ?? []) as IndexEquipment[],
        providers:   (prRes.data  ?? []) as IndexProvider[],
      }
    },
    enabled: enabled && isSessionReady,
    staleTime: 2 * 60 * 1000,
    gcTime:    5 * 60 * 1000,
  })
}
