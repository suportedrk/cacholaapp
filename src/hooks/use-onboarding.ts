'use client'

import { useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { hasRole, ONBOARDING_VIEW_ROLES } from '@/config/roles'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { useUnitStore } from '@/stores/unit-store'

// localStorage key — used as a session-level guard to prevent re-show on quick refresh
const ONBOARDING_KEY = 'cachola-onboarding-done'

// ── Welcome trigger ──────────────────────────────────────────

export function useOnboarding() {
  const { profile, loading } = useAuth()
  const { setWelcomeOpen } = useOnboardingStore()

  useEffect(() => {
    if (loading || !profile) return

    // Fast-path: localStorage flag (written immediately on dismiss)
    if (typeof window !== 'undefined' && localStorage.getItem(ONBOARDING_KEY) === 'true') return

    // DB flag via preferences JSONB
    const prefs = profile.preferences as Record<string, unknown> | null
    if (prefs?.onboarding_completed === true) {
      if (typeof window !== 'undefined') localStorage.setItem(ONBOARDING_KEY, 'true')
      return
    }

    // Small delay so layout renders first
    const t = setTimeout(() => setWelcomeOpen(true), 800)
    return () => clearTimeout(t)
  }, [profile?.id, loading]) // eslint-disable-line react-hooks/exhaustive-deps
}

// ── Mark completed (DB + localStorage) ──────────────────────

export function useCompleteOnboarding() {
  const { profile } = useAuth()

  return useMutation({
    mutationFn: async () => {
      if (!profile) return

      // Optimistically set localStorage
      if (typeof window !== 'undefined') localStorage.setItem(ONBOARDING_KEY, 'true')

      const supabase = createClient()
      const prefs = (profile.preferences as Record<string, unknown>) ?? {}
      await supabase
        .from('users')
        .update({ preferences: { ...prefs, onboarding_completed: true } })
        .eq('id', profile.id)
    },
  })
}

// ── Setup checklist status ───────────────────────────────────

export interface SetupStatus {
  ploomes: boolean
  checklistTemplate: boolean
  equipment: boolean
  teamMembers: boolean
}

export function useSetupChecklist() {
  const { profile } = useAuth()
  const activeUnitId = useUnitStore((s) => s.activeUnitId)

  const isAdmin = hasRole(profile?.role, ONBOARDING_VIEW_ROLES)

  return useQuery({
    queryKey: ['setup-checklist', activeUnitId, profile?.id],
    queryFn: async (): Promise<SetupStatus> => {
      const supabase = createClient()

      const [ploomesRes, templatesRes, equipmentRes, usersRes] = await Promise.all([
        // Ploomes configured (has a config row with pipeline_id set)
        supabase
          .from('ploomes_config')
          .select('id', { count: 'exact', head: true })
          .not('pipeline_id', 'is', null),

        // At least one active checklist template
        (() => {
          let q = supabase
            .from('checklist_templates')
            .select('id', { count: 'exact', head: true })
            .eq('is_active', true)
          if (activeUnitId) q = q.eq('unit_id', activeUnitId)
          return q
        })(),

        // At least one active/in-service equipment
        (() => {
          let q = supabase
            .from('equipment')
            .select('id', { count: 'exact', head: true })
            .in('status', ['active', 'in_repair'])
          if (activeUnitId) q = q.eq('unit_id', activeUnitId)
          return q
        })(),

        // At least one other active user (team members)
        supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
          .neq('id', profile!.id),
      ])

      return {
        ploomes: (ploomesRes.count ?? 0) > 0,
        checklistTemplate: (templatesRes.count ?? 0) > 0,
        equipment: (equipmentRes.count ?? 0) > 0,
        teamMembers: (usersRes.count ?? 0) > 0,
      }
    },
    enabled: !!profile && isAdmin,
    staleTime: 5 * 60 * 1000,
  })
}
