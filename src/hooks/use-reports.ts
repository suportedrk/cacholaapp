'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'
import type {
  ReportFilters,
  EventReportSummary,
  EventsByMonth,
  EventsByType,
  EventsByVenue,
  MaintenanceReportSummary,
  MaintenanceByMonth,
  MaintenanceBySector,
  ChecklistReportSummary,
  ChecklistsByMonth,
  ChecklistsByCategory,
  StaffReportSummary,
  StaffByEvents,
  StaffByChecklists,
} from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function rpcArgs(filters: ReportFilters) {
  return {
    p_unit_id: filters.unitId ?? null,
    p_from:    filters.from,
    p_to:      filters.to,
  }
}

// ─────────────────────────────────────────────────────────────
// HOOK: RELATÓRIO DE EVENTOS
// ─────────────────────────────────────────────────────────────

export function useEventReport(filters: ReportFilters) {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const effectiveFilters = { ...filters, unitId: filters.unitId ?? activeUnitId }
  const args = rpcArgs(effectiveFilters)

  const summary = useQuery({
    queryKey: ['report', 'events', 'summary', effectiveFilters],
    enabled: isSessionReady,
    queryFn: async () => {
      const { data, error } = await createClient()
        .rpc('report_events_summary', args)
      if (error) throw error
      return (data?.[0] ?? {
        total_events: 0, avg_guests: 0,
        top_event_type: null, top_venue: null,
      }) as EventReportSummary
    },
    staleTime: 5 * 60 * 1000,
  })

  const byMonth = useQuery({
    queryKey: ['report', 'events', 'by-month', effectiveFilters],
    queryFn: async () => {
      const { data, error } = await createClient()
        .rpc('report_events_by_month', args)
      if (error) throw error
      return (data ?? []) as EventsByMonth[]
    },
    staleTime: 5 * 60 * 1000,
  })

  const byType = useQuery({
    queryKey: ['report', 'events', 'by-type', effectiveFilters],
    queryFn: async () => {
      const { data, error } = await createClient()
        .rpc('report_events_by_type', args)
      if (error) throw error
      return (data ?? []) as EventsByType[]
    },
    staleTime: 5 * 60 * 1000,
  })

  const byVenue = useQuery({
    queryKey: ['report', 'events', 'by-venue', effectiveFilters],
    queryFn: async () => {
      const { data, error } = await createClient()
        .rpc('report_events_by_venue', args)
      if (error) throw error
      return (data ?? []) as EventsByVenue[]
    },
    staleTime: 5 * 60 * 1000,
  })

  // Tabela de detalhes (client-side query com paginação)
  const detail = useQuery({
    queryKey: ['report', 'events', 'detail', effectiveFilters],
    queryFn: async () => {
      let q = createClient()
        .from('events')
        .select(`
          id, title, date, guest_count, status,
          event_type:event_types(name),
          package:packages(name),
          venue:venues(name)
        `)
        .gte('date', filters.from)
        .lte('date', filters.to)
        .order('date', { ascending: false })
        .limit(200)
      if (effectiveFilters.unitId) q = q.eq('unit_id', effectiveFilters.unitId)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })

  return { summary, byMonth, byType, byVenue, detail }
}

// ─────────────────────────────────────────────────────────────
// HOOK: RELATÓRIO DE MANUTENÇÃO
// ─────────────────────────────────────────────────────────────

export function useMaintenanceReport(filters: ReportFilters) {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const effectiveFilters = { ...filters, unitId: filters.unitId ?? activeUnitId }
  const args = rpcArgs(effectiveFilters)

  const summary = useQuery({
    queryKey: ['report', 'maintenance', 'summary', effectiveFilters],
    enabled: isSessionReady,
    queryFn: async () => {
      const { data, error } = await createClient()
        .rpc('report_maintenance_summary', args)
      if (error) throw error
      return (data?.[0] ?? {
        total_open: 0, total_completed: 0,
        avg_resolution_days: null, top_sector: null,
      }) as MaintenanceReportSummary
    },
    staleTime: 5 * 60 * 1000,
  })

  const byMonth = useQuery({
    queryKey: ['report', 'maintenance', 'by-month', effectiveFilters],
    queryFn: async () => {
      const { data, error } = await createClient()
        .rpc('report_maintenance_by_month', args)
      if (error) throw error
      return (data ?? []) as MaintenanceByMonth[]
    },
    staleTime: 5 * 60 * 1000,
  })

  const bySector = useQuery({
    queryKey: ['report', 'maintenance', 'by-sector', effectiveFilters],
    queryFn: async () => {
      const { data, error } = await createClient()
        .rpc('report_maintenance_by_sector', args)
      if (error) throw error
      return (data ?? []) as MaintenanceBySector[]
    },
    staleTime: 5 * 60 * 1000,
  })

  const detail = useQuery({
    queryKey: ['report', 'maintenance', 'detail', effectiveFilters],
    queryFn: async () => {
      let q = createClient()
        .from('maintenance_orders')
        .select(`
          id, title, type, priority, status, created_at, updated_at,
          sector:sectors(name),
          assigned_user:users!maintenance_orders_assigned_to_fkey(name)
        `)
        .gte('created_at', filters.from)
        .lte('created_at', filters.to + 'T23:59:59')
        .order('created_at', { ascending: false })
        .limit(200)
      if (effectiveFilters.unitId) q = q.eq('unit_id', effectiveFilters.unitId)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })

  return { summary, byMonth, bySector, detail }
}

// ─────────────────────────────────────────────────────────────
// HOOK: RELATÓRIO DE CHECKLISTS
// ─────────────────────────────────────────────────────────────

export function useChecklistReport(filters: ReportFilters) {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const effectiveFilters = { ...filters, unitId: filters.unitId ?? activeUnitId }
  const args = rpcArgs(effectiveFilters)

  const summary = useQuery({
    queryKey: ['report', 'checklists', 'summary', effectiveFilters],
    enabled: isSessionReady,
    queryFn: async () => {
      const { data, error } = await createClient()
        .rpc('report_checklists_summary', args)
      if (error) throw error
      return (data?.[0] ?? {
        total: 0, on_time_count: 0,
        overdue_count: 0, top_overdue_cat: null,
      }) as ChecklistReportSummary
    },
    staleTime: 5 * 60 * 1000,
  })

  const byMonth = useQuery({
    queryKey: ['report', 'checklists', 'by-month', effectiveFilters],
    queryFn: async () => {
      const { data, error } = await createClient()
        .rpc('report_checklists_by_month', args)
      if (error) throw error
      return (data ?? []) as ChecklistsByMonth[]
    },
    staleTime: 5 * 60 * 1000,
  })

  const byCategory = useQuery({
    queryKey: ['report', 'checklists', 'by-category', effectiveFilters],
    queryFn: async () => {
      const { data, error } = await createClient()
        .rpc('report_checklists_by_category', args)
      if (error) throw error
      return (data ?? []) as ChecklistsByCategory[]
    },
    staleTime: 5 * 60 * 1000,
  })

  const detail = useQuery({
    queryKey: ['report', 'checklists', 'detail', effectiveFilters],
    queryFn: async () => {
      let q = createClient()
        .from('checklists')
        .select(`
          id, title, status, due_date, created_at,
          event:events(title),
          assigned_user:users!checklists_assigned_to_fkey(name),
          template:checklist_templates(
            category:checklist_categories(name)
          ),
          checklist_items(id, status)
        `)
        .gte('created_at', filters.from)
        .lte('created_at', filters.to + 'T23:59:59')
        .order('created_at', { ascending: false })
        .limit(200)
      if (effectiveFilters.unitId) q = q.eq('unit_id', effectiveFilters.unitId)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })

  return { summary, byMonth, byCategory, detail }
}

// ─────────────────────────────────────────────────────────────
// HOOK: RELATÓRIO DE EQUIPE
// ─────────────────────────────────────────────────────────────

export function useStaffReport(filters: ReportFilters) {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const effectiveFilters = { ...filters, unitId: filters.unitId ?? activeUnitId }
  const args = rpcArgs(effectiveFilters)

  const summary = useQuery({
    queryKey: ['report', 'staff', 'summary', effectiveFilters],
    enabled: isSessionReady,
    queryFn: async () => {
      const { data, error } = await createClient()
        .rpc('report_staff_summary', args)
      if (error) throw error
      return (data?.[0] ?? {
        top_events_user: null,
        top_checklists_user: null,
        avg_events_per_user: null,
      }) as StaffReportSummary
    },
    staleTime: 5 * 60 * 1000,
  })

  const byEvents = useQuery({
    queryKey: ['report', 'staff', 'by-events', effectiveFilters],
    queryFn: async () => {
      const { data, error } = await createClient()
        .rpc('report_staff_by_events', args)
      if (error) throw error
      return (data ?? []) as StaffByEvents[]
    },
    staleTime: 5 * 60 * 1000,
  })

  const byChecklists = useQuery({
    queryKey: ['report', 'staff', 'by-checklists', effectiveFilters],
    queryFn: async () => {
      const { data, error } = await createClient()
        .rpc('report_staff_by_checklists', args)
      if (error) throw error
      return (data ?? []) as StaffByChecklists[]
    },
    staleTime: 5 * 60 * 1000,
  })

  return { summary, byEvents, byChecklists }
}
