'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { User as AppUser, UserUnitWithUnit } from '@/types/database.types'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'
import { useImpersonateStore } from '@/stores/impersonate-store'

/**
 * Hook de autenticação — lê estado dos stores Zustand.
 *
 * A subscrição a onAuthStateChange e o carregamento de dados ficam no
 * AuthBootstrap (providers.tsx), que monta UMA única vez. Este hook é um
 * leitor puro: não faz getSession(), não registra listeners, não faz queries.
 *
 * Isso evita o bug de "N componentes chamam useAuth() → N listeners →
 * N chamadas a loadUserUnits() → skeleton de loading infinito".
 *
 * Modo "Ver como" (impersonate):
 * - profile e userUnits são substituídos pelos dados do usuário impersonado
 * - session e user (Supabase Auth) NUNCA mudam — são sempre do admin real
 * - activeUnitId é gerenciado pelo UnitStore (já substituído ao iniciar impersonate)
 */
export function useAuth() {
  const router = useRouter()
  const supabase = createClient()

  const { activeUnitId, userUnits } = useUnitStore()
  const { isSessionReady, user, session, profile: realProfile } = useAuthReadyStore()

  // Impersonate: quando ativo, substitui profile e userUnits
  const { isImpersonating, impersonatedProfile, impersonatedUserUnits } = useImpersonateStore()

  const profile = isImpersonating ? impersonatedProfile : realProfile
  const effectiveUserUnits = isImpersonating
    ? (impersonatedUserUnits ?? [])
    : (userUnits as UserUnitWithUnit[])

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
    // Auth real — NUNCA alterados pelo impersonate
    user: user as User | null,
    session,
    isAuthenticated: !!user,

    // Dados contextuais — substituídos pelo impersonate quando ativo
    profile: profile as AppUser | null,
    /** Profile real do usuário logado — nunca alterado pelo impersonate.
     *  Usar quando se precisa verificar se EU (admin) tenho uma permissão,
     *  independentemente de qual usuário estou visualizando. */
    realProfile: realProfile as AppUser | null,
    userUnits: effectiveUserUnits,

    // Unidade ativa — gerenciada pelo UnitStore (já substituída ao iniciar impersonate)
    activeUnitId,

    loading: !isSessionReady,
    error: null as string | null,

    // Impersonate
    isImpersonating,

    signIn,
    signOut,
    resetPassword,
  }
}
