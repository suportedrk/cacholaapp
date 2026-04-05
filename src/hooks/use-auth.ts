'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { User as AppUser, UserUnitWithUnit } from '@/types/database.types'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'

/**
 * Hook de autenticação — lê estado dos stores Zustand.
 *
 * A subscrição a onAuthStateChange e o carregamento de dados ficam no
 * AuthBootstrap (providers.tsx), que monta UMA única vez. Este hook é um
 * leitor puro: não faz getSession(), não registra listeners, não faz queries.
 *
 * Isso evita o bug de "N componentes chamam useAuth() → N listeners →
 * N chamadas a loadUserUnits() → skeleton de loading infinito".
 */
export function useAuth() {
  const router = useRouter()
  const supabase = createClient()

  const { activeUnitId, userUnits } = useUnitStore()
  const { isSessionReady, user, session, profile } = useAuthReadyStore()

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        return { success: false, error: error.message }
      }
      return { success: true, error: null }
    },
    [supabase]
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    // O AuthBootstrap detecta SIGNED_OUT e faz router.push('/login').
    // Chamamos explicitamente aqui também para garantir redirect imediato.
    router.push('/login')
  }, [supabase, router])

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
    user: user as User | null,
    session,
    profile: profile as AppUser | null,
    loading: !isSessionReady,
    error: null as string | null,
    // Unidades (já reativos via Zustand)
    activeUnitId,
    userUnits: userUnits as UserUnitWithUnit[],
    signIn,
    signOut,
    resetPassword,
    isAuthenticated: !!user,
  }
}
