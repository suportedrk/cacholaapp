import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database.types'

// Singleton — uma única instância por tab de browser.
// Múltiplas instâncias de createBrowserClient competem pelo mesmo lock
// de localStorage ("lock:sb-localhost-auth-token"), causando timeouts de 5s
// que travam TODAS as chamadas autenticadas ao Supabase (skeleton infinito).
let _client: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createClient() {
  if (!_client) {
    _client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        realtime: {
          params: { eventsPerSecond: 1 },
          // Backoff exponencial com teto de 60s — evita loop infinito de
          // reconexão quando o WebSocket não está acessível (Kong Docker local).
          // Em produção com Realtime configurado, o comportamento é o mesmo
          // mas as conexões terão sucesso antes de atingir o teto.
          reconnectAfterMs: (tries: number) =>
            Math.min(1000 * Math.pow(2, tries), 60_000),
        },
      }
    )
    // Realtime habilitado em produção via wss://api.cachola.cloud/realtime/v1/
    // (Nginx WebSocket proxy configurado). Workaround de disconnect() removido.
  }
  return _client
}
