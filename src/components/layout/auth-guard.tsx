'use client'

import { useAuthReadyStore } from '@/stores/auth-store'

/**
 * Bloqueia a renderização dos filhos até que a sessão Supabase
 * tenha sido verificada pelo menos uma vez (getSession() resolvido).
 *
 * Isso garante que NENHUMA query do React Query dispare antes de:
 *   1. Sabermos se o usuário está autenticado
 *   2. As unidades do usuário terem sido carregadas no Zustand store
 *
 * Na navegação cliente (Link/router.push), isSessionReady já é true
 * (valor em memória), então o guard passa imediatamente sem spinner.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  if (!isSessionReady) {
    return (
      <div className="flex h-svh w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
