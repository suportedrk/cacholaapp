import { create } from 'zustand'

/**
 * Sinaliza quando a sessão Supabase foi verificada pela primeira vez.
 * Usado como gate global para evitar que queries disparem antes da sessão estar pronta.
 *
 * - isSessionReady: false → getSession() ainda não resolveu, bloquear queries
 * - isSessionReady: true  → sessão confirmada (ou ausente), liberar queries
 */
interface AuthReadyStore {
  isSessionReady: boolean
  setSessionReady: () => void
}

export const useAuthReadyStore = create<AuthReadyStore>((set) => ({
  isSessionReady: false,
  setSessionReady: () => set({ isSessionReady: true }),
}))
