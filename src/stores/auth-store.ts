import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import type { User as AppUser } from '@/types/database.types'

/**
 * Store central de autenticação.
 *
 * - isSessionReady: false → getSession() ainda não resolveu; bloqueia queries
 * - isSessionReady: true  → sessão verificada (ou ausente); libera queries
 * - user/session/profile  → dados do usuário logado (null = não autenticado)
 *
 * IMPORTANT: A subscrição a onAuthStateChange e o carregamento de dados
 * ficam no AuthBootstrap (providers.tsx), que monta UMA vez. Não duplicar aqui.
 */
interface AuthReadyStore {
  isSessionReady: boolean
  setSessionReady: () => void

  user: User | null
  session: Session | null
  profile: AppUser | null

  setAuthState: (
    user: User | null,
    session: Session | null,
    profile: AppUser | null
  ) => void
  resetAuth: () => void
}

export const useAuthReadyStore = create<AuthReadyStore>((set) => ({
  isSessionReady: false,
  setSessionReady: () => set({ isSessionReady: true }),

  user: null,
  session: null,
  profile: null,

  setAuthState: (user, session, profile) => set({ user, session, profile }),
  resetAuth: () => set({ user: null, session: null, profile: null }),
}))
