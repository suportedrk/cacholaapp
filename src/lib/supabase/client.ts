import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { useImpersonateStore } from '@/stores/impersonate-store'
import type { Database } from '@/types/database.types'

// Singleton — uma única instância por tab de browser.
// Múltiplas instâncias de createBrowserClient competem pelo mesmo lock
// de localStorage ("lock:sb-localhost-auth-token"), causando timeouts de 5s
// que travam TODAS as chamadas autenticadas ao Supabase (skeleton infinito).
let _client: ReturnType<typeof createBrowserClient<Database>> | null = null

function getNormalClient() {
  if (!_client) {
    _client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        realtime: {
          params: { eventsPerSecond: 1 },
          reconnectAfterMs: (tries: number) =>
            Math.min(1000 * Math.pow(2, tries), 60_000),
        },
      }
    )
  }
  return _client
}

// Cliente do modo "Ver como" (impersonation 2A): usa o JWT MINTADO do usuário-alvo via a
// opção `accessToken` do supabase-js. Com `accessToken`, o supabase-js NÃO inicializa o
// GoTrue auth client — sem sessão, sem localStorage, sem lock (não compete com o singleton
// normal). O token é lido dinamicamente da store a cada request; o read-only é imposto no
// banco (migrations 175/176/177), então toda escrita por este client é barrada (42501).
let _impersonationClient: ReturnType<typeof createSupabaseClient<Database>> | null = null

function getImpersonationClient() {
  if (!_impersonationClient) {
    _impersonationClient = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        accessToken: async () => useImpersonateStore.getState().impersonationToken ?? '',
        realtime: {
          params: { eventsPerSecond: 1 },
          reconnectAfterMs: (tries: number) =>
            Math.min(1000 * Math.pow(2, tries), 60_000),
        },
      }
    )
  }
  return _impersonationClient
}

/**
 * Client Supabase do browser. Em modo "Ver como" (token na store), devolve o client de
 * impersonação (lê os dados como o alvo via RLS); caso contrário, o client normal (sessão
 * real do admin). React Query re-executa os queryFns no invalidateQueries do start/stop,
 * então a troca de client é transparente.
 */
export function createClient() {
  const token = useImpersonateStore.getState().impersonationToken
  return token ? getImpersonationClient() : getNormalClient()
}
