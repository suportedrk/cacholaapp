'use client'

import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { createClient } from '@/lib/supabase/client'

/**
 * Escuta mudanças de autenticação e sincroniza o cache do React Query.
 * - SIGNED_IN: invalidar tudo (dados frescos para o usuário)
 * - SIGNED_OUT: limpar tudo (sem dados de outro usuário no cache)
 * - TOKEN_REFRESHED: mesma sessão, só token novo → não revalidar
 */
function AuthCacheSync() {
  const qc = useQueryClient()

  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        qc.invalidateQueries()
      } else if (event === 'SIGNED_OUT') {
        qc.clear()
      }
    })
    return () => subscription.unsubscribe()
  }, [qc])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minuto
            // Não retentar erros de autenticação — falhar rápido
            retry: (failureCount, error: unknown) => {
              const status = (error as { status?: number; code?: number })?.status
                          ?? (error as { status?: number; code?: number })?.code
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
        <AuthCacheSync />
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
