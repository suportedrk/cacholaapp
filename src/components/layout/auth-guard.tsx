'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'

/**
 * Bloqueia a renderização dos filhos até que a sessão Supabase
 * tenha sido verificada pelo menos uma vez.
 *
 * O AuthGuard faz seu próprio getSession() leve para não depender
 * do useAuth() do Navbar (que só roda DENTRO dos filhos). Sem isso,
 * haveria dependência circular: guard bloqueia AppLayout → Navbar
 * nunca monta → useAuth() nunca chama setSessionReady() → spinner eterno.
 *
 * Na navegação cliente (Link/router.push), isSessionReady já é true
 * em memória — o guard passa imediatamente sem spinner.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const setSessionReady = useAuthReadyStore((s) => s.setSessionReady)

  useEffect(() => {
    // Se já está pronto (navegação client-side), não faz nada
    if (isSessionReady) return

    // Verificação leve: só precisa saber se a sessão existe
    const supabase = createClient()
    supabase.auth.getSession().then(() => {
      setSessionReady()
    })
  }, [isSessionReady, setSessionReady])

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
