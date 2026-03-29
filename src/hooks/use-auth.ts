'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User, Session } from '@supabase/supabase-js'
import type { User as AppUser, UserUnitWithUnit } from '@/types/database.types'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'

interface AuthState {
  user: User | null
  session: Session | null
  profile: AppUser | null
  loading: boolean
  error: string | null
}

export function useAuth() {
  const router = useRouter()
  const supabase = createClient()
  const { setUserUnits, setActiveUnit, activeUnitId, userUnits, reset: resetUnit } = useUnitStore()

  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    loading: true,
    error: null,
  })

  // Carrega perfil do usuário
  const loadProfile = useCallback(
    async (userId: string) => {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()
      return data as AppUser | null
    },
    [supabase]
  )

  // Carrega unidades do usuário e inicializa a unidade ativa
  const loadUserUnits = useCallback(
    async (userId: string) => {
      const { data } = await supabase
        .from('user_units')
        .select(`
          *,
          unit:units(id, name, slug, is_active)
        `)
        .eq('user_id', userId)
        .order('is_default', { ascending: false })

      const units = (data ?? []) as unknown as UserUnitWithUnit[]
      setUserUnits(units)

      // Restaurar unidade do localStorage, ou usar a default, ou a primeira disponível
      const stored = useUnitStore.getState().activeUnitId
      const storedUnit = stored ? units.find((u) => u.unit_id === stored) : null

      if (storedUnit) {
        // A unidade persistida ainda é válida — apenas sincroniza o objeto
        setActiveUnit(storedUnit.unit_id, storedUnit.unit as { id: string; name: string; slug: string })
      } else {
        // Selecionar unidade padrão ou primeira disponível
        const defaultUnit = units.find((u) => u.is_default) ?? units[0]
        if (defaultUnit) {
          setActiveUnit(defaultUnit.unit_id, defaultUnit.unit as { id: string; name: string; slug: string })
        } else {
          setActiveUnit(null, null)
        }
      }
    },
    [supabase, setUserUnits, setActiveUnit]
  )

  useEffect(() => {
    // Sessão inicial
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const profile = session?.user ? await loadProfile(session.user.id) : null
      if (session?.user) await loadUserUnits(session.user.id)

      setState({
        user: session?.user ?? null,
        session,
        profile,
        loading: false,
        error: null,
      })

      // Sinaliza que a sessão foi verificada — libera todas as queries
      useAuthReadyStore.getState().setSessionReady()
    })

    // Listener de mudanças de auth
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const profile = session?.user ? await loadProfile(session.user.id) : null
      if (session?.user) {
        await loadUserUnits(session.user.id)
      }

      setState({
        user: session?.user ?? null,
        session,
        profile,
        loading: false,
        error: null,
      })

      if (event === 'SIGNED_OUT') {
        resetUnit()
        router.push('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase, loadProfile, loadUserUnits, resetUnit, router])

  const signIn = useCallback(
    async (email: string, password: string) => {
      setState((prev) => ({ ...prev, loading: true, error: null }))

      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        const message =
          error.message === 'Invalid login credentials'
            ? 'E-mail ou senha incorretos'
            : 'Erro ao fazer login. Tente novamente.'

        setState((prev) => ({ ...prev, loading: false, error: message }))
        return { success: false, error: message }
      }

      setState((prev) => ({ ...prev, loading: false, error: null }))
      return { success: true, error: null }
    },
    [supabase]
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [supabase])

  const resetPassword = useCallback(
    async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/nova-senha`,
      })

      if (error) {
        return { success: false, error: 'Erro ao enviar e-mail. Tente novamente.' }
      }

      return { success: true, error: null }
    },
    [supabase]
  )

  return {
    user: state.user,
    session: state.session,
    profile: state.profile,
    loading: state.loading,
    error: state.error,
    // Unidades
    activeUnitId,
    userUnits,
    signIn,
    signOut,
    resetPassword,
    isAuthenticated: !!state.user,
  }
}
