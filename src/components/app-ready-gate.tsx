'use client'

import { useAuthReadyStore } from '@/stores/auth-store'
import { useUnitStore } from '@/stores/unit-store'

/**
 * Bloqueia a renderização das páginas até que:
 * 1. A sessão Supabase tenha sido verificada (isSessionReady)
 * 2. O persist middleware do Zustand tenha rehidratado o localStorage (_hasHydrated)
 *
 * Isso elimina a race condition onde queries disparavam com activeUnitId=null
 * antes de o localStorage ser lido, causando skeleton intermitente.
 *
 * Na navegação client-side ambas as flags já estão true em memória —
 * o gate passa imediatamente sem spinner.
 */
export function AppReadyGate({ children }: { children: React.ReactNode }) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const _hasHydrated   = useUnitStore((s) => s._hasHydrated)

  if (!isSessionReady || !_hasHydrated) {
    return (
      <div className="flex h-svh w-full items-center justify-center bg-background">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return <>{children}</>
}
