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
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _client
}
