'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'
import { useUnitStore } from '@/stores/unit-store'
import type { User as AppUser, UserUnitWithUnit } from '@/types/database.types'

/**
 * AuthBootstrap — monta UMA única vez na árvore inteira.
 *
 * Responsabilidades:
 *  1. getSession() inicial → carrega profile + user_units
 *  2. onAuthStateChange → mantém estado sincronizado com o Supabase
 *  3. Sincroniza o cache do React Query (SIGNED_IN invalida, SIGNED_OUT limpa)
 *
 * MOTIVO: useAuth() é chamado por ~24 arquivos simultaneamente. Se cada
 * instância registrasse seu próprio onAuthStateChange, o evento inicial
 * SIGNED_IN (que o Supabase dispara imediatamente ao subscrever) chamaria
 * loadUserUnits() 20+ vezes, causando skeleton de loading infinito.
 */
function AuthBootstrap() {
  const qc = useQueryClient()
  const router = useRouter()
  // Ref para evitar que a troca de referência do router recrie o efeito
  const routerRef = useRef(router)
  useEffect(() => { routerRef.current = router }, [router])

  useEffect(() => {
    const supabase = createClient()
    const { setAuthState, setSessionReady, resetAuth } = useAuthReadyStore.getState()
    const { setUserUnits, setActiveUnit, reset: resetUnit } = useUnitStore.getState()

    async function loadProfile(userId: string): Promise<AppUser | null> {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()
      return data as AppUser | null
    }

    async function loadUserUnits(userId: string): Promise<void> {
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
        setActiveUnit(
          storedUnit.unit_id,
          storedUnit.unit as { id: string; name: string; slug: string }
        )
      } else {
        const defaultUnit = units.find((u) => u.is_default) ?? units[0]
        if (defaultUnit) {
          setActiveUnit(
            defaultUnit.unit_id,
            defaultUnit.unit as { id: string; name: string; slug: string }
          )
        } else {
          setActiveUnit(null, null)
        }
      }
    }

    // ── Carga inicial ────────────────────────────────────────────────────────
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await loadProfile(session.user.id)
        await loadUserUnits(session.user.id)
        setAuthState(session.user, session, profile)
      } else {
        setAuthState(null, null, null)
      }
      setSessionReady()
    })

    // ── Listener de mudanças de auth ─────────────────────────────────────────
    // O Supabase v2 dispara SIGNED_IN imediatamente ao subscrever quando já
    // existe sessão. Pulamos esse primeiro evento pois a carga inicial via
    // getSession() já cuidou dos dados.
    let isInitialEvent = true

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN') {
        if (isInitialEvent) {
          isInitialEvent = false
          return
        }
        // Login real (após logout ou expiração de sessão)
        if (session?.user) {
          const profile = await loadProfile(session.user.id)
          await loadUserUnits(session.user.id)
          setAuthState(session.user, session, profile)
        }
        qc.invalidateQueries()
      } else if (event === 'SIGNED_OUT') {
        resetAuth()
        resetUnit()
        qc.clear()
        routerRef.current.push('/login')
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // Apenas atualiza o token — não recarrega profile ou units
        setAuthState(
          session.user,
          session,
          useAuthReadyStore.getState().profile
        )
      }
      isInitialEvent = false
    })

    // ── Visibilitychange: re-valida sessão ao retornar de background ─────────
    // Quando a aba fica em background, o browser pode suspender o timer de
    // autoRefreshToken do Supabase. Ao voltar, verificamos o estado da sessão
    // SEM chamar getSession() (que adquire um lock exclusivo de auth e
    // competiria com os refetchOnWindowFocus das queries que disparam ao mesmo
    // tempo, causando serialização e loading infinito de até 12s).
    //
    // Em vez disso:
    //  1. Lemos a sessão já cached no Zustand store (sem lock)
    //  2. Se não há sessão → redireciona para login imediatamente
    //  3. Se o token está expirado → agendamos getSession() com 300ms de
    //     atraso para não correr com o mount das queries
    //  4. Se o token é válido → apenas reativos o timer de autoRefresh
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return

      const { session } = useAuthReadyStore.getState()

      if (!session) {
        // Sem sessão em memória — usuário provavelmente foi deslogado
        resetAuth()
        resetUnit()
        qc.clear()
        routerRef.current.push('/login')
        return
      }

      const expiresAt = session.expires_at ?? 0
      const nowSec    = Math.floor(Date.now() / 1000)
      const isExpired = expiresAt - nowSec < 60 // expirado ou expira em < 60s

      if (isExpired) {
        // Token expirado: agendar refresh APÓS as queries montarem (300ms)
        // para evitar lock contention com refetchOnWindowFocus
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: { session: fresh } }) => {
            if (!fresh) {
              resetAuth()
              resetUnit()
              qc.clear()
              routerRef.current.push('/login')
            }
          })
        }, 300)
        return
      }

      // Token válido: reativar timer suspenso pelo browser
      supabase.auth.startAutoRefresh()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [qc]) // router via ref — não entra no array de deps

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            networkMode: 'always', // ignora navigator.onLine — evita lock contention no Supabase auth
            staleTime: 60 * 1000, // 1 minuto
            // Não retentar erros de autenticação — falhar rápido
            retry: (failureCount, error: unknown) => {
              const status =
                (error as { status?: number; code?: number })?.status ??
                (error as { status?: number; code?: number })?.code
              if (status === 401 || status === 403) return false
              return failureCount < 2
            },
            refetchOnWindowFocus: true,
            refetchOnMount: true,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthBootstrap />
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            duration: 4000,
          }}
        />
        {process.env.NODE_ENV === 'development' && (
          <ReactQueryDevtools initialIsOpen={false} />
        )}
      </TooltipProvider>
    </QueryClientProvider>
  )
}
