import type { ErrorEvent, EventHint } from '@sentry/nextjs'

/**
 * Sanitização de PII antes de qualquer evento sair para o Sentry.
 *
 * LGPD — buffet INFANTIL: nenhum dado pessoal (de cliente, do aniversariante
 * menor de idade, ou de funcionário) pode trafegar para um serviço externo.
 * Mantemos apenas o `id` interno do usuário logado (UUID do staff, útil para
 * correlação e não é PII de criança). Tudo mais é redigido.
 *
 * A lista de chaves espelha os campos sensíveis já tratados pelo
 * `sanitize-events.ts` do export de calendário.
 */
const PII_KEYS = new Set(
  [
    'client_name',
    'birthday_person',
    'owner_name',
    'client_contact',
    'contact_name',
    'name',
    'full_name',
    'email',
    'phone',
    'phones',
    'birthday',
    'aniversariante_birthday',
    'cpf',
    'password',
    'token',
    'access_token',
    'refresh_token',
  ].map((k) => k.toLowerCase()),
)

/**
 * Artefatos TRANSITÓRIOS da janela de deploy — não são bugs do app.
 *
 * Em produção o deploy faz `next build` no lugar: o `.next/` é reescrito
 * enquanto o processo PM2 antigo ainda atende requisições. Nesse intervalo o
 * processo velho não acha chunks/manifests que o build sobrescreveu, gerando
 * "Could not find the module .../next/dist/..." e o InvariantError do client
 * reference manifest. Some assim que o PM2 reinicia no build novo (confirmado
 * pelo /api/build-info). É ruído recorrente (~1×/deploy) que afoga o sinal real
 * → descartado aqui. Se um deploy quebrar DE VERDADE, o healthcheck do
 * deploy.yml falha e o build-info não avança — esses sinais cobrem o caso real.
 *
 * Escopo proposital: o 1º padrão exige `next/dist/` no caminho, então um erro
 * de módulo do NOSSO código (ex.: "@/components/foo") NÃO é silenciado.
 */
const TRANSIENT_BUILD_PATTERNS: RegExp[] = [
  /could not find the module.*next[/\\]dist[/\\]/i,
  /client reference manifest for route .* does not exist/i,
]

function isTransientBuildArtifact(event: ErrorEvent): boolean {
  const values = event.exception?.values
  if (!values?.length) return false
  return values.some((v) => {
    const text = `${v.type ?? ''}: ${v.value ?? ''}`
    return TRANSIENT_BUILD_PATTERNS.some((re) => re.test(text))
  })
}

/**
 * Ruído BENIGNO do lock de auth do Supabase (Web Locks / @supabase/ssr).
 *
 * Em páginas pesadas (ex.: /dashboard dispara muitas queries no mount) o refresh
 * do token concorre com outras chamadas de auth e o supabase-js "rouba" o lock:
 * a chamada que perdeu rejeita com `AbortError: Lock was stolen by another
 * request` e loga `lock:sb-...-auth-token ... was released because another
 * request stole it`. A chamada que roubou o lock CONCLUI normalmente — NÃO trava
 * o usuário. É mecanismo interno de coordenação do token, não bug do app.
 *
 * O client é singleton (`src/lib/supabase/client.ts`) e não há `getUser()` em
 * `useEffect` — os anti-padrões que causariam lock REAL já estão cobertos; isto é
 * só o ruído residual inerente ao supabase-js. Descartado aqui para não afogar o
 * sinal real (fadiga de alerta), espelhando o filtro de ruído de deploy acima.
 * Escopo proposital: só as 2 mensagens exatas do supabase-js — qualquer outro
 * erro (mesmo AbortError de outra origem) NÃO é silenciado.
 */
const BENIGN_AUTH_LOCK_PATTERNS: RegExp[] = [
  /lock was stolen by another request/i,
  /was released because another request stole it/i,
]

function isBenignAuthLockNoise(event: ErrorEvent): boolean {
  const values = event.exception?.values
  if (!values?.length) return false
  return values.some((v) => {
    const text = `${v.type ?? ''}: ${v.value ?? ''}`
    return BENIGN_AUTH_LOCK_PATTERNS.some((re) => re.test(text))
  })
}

function redactDeep(value: unknown, depth = 0): unknown {
  if (depth > 6 || value == null) return value
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, depth + 1))
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = PII_KEYS.has(k.toLowerCase()) ? '[redacted]' : redactDeep(v, depth + 1)
    }
    return out
  }
  return value
}

/** `beforeSend` compartilhado por client, server e edge. */
export function scrubEvent(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  // Descarta o ruído transitório da janela de deploy antes de qualquer coisa.
  if (isTransientBuildArtifact(event)) return null
  // Descarta o ruído benigno do lock de auth do Supabase (lock "roubado").
  if (isBenignAuthLockNoise(event)) return null

  // Identificação do usuário: mantém só o id interno (sem e-mail/nome/ip).
  if (event.user) {
    event.user = event.user.id ? { id: event.user.id } : {}
  }

  // Request: remove corpo, cookies, headers e querystring (podem conter PII).
  if (event.request) {
    delete event.request.data
    delete event.request.cookies
    delete event.request.headers
    delete event.request.query_string
    if (event.request.url) event.request.url = event.request.url.split('?')[0]
  }

  // Extras e contexts: redação profunda por nome de chave.
  if (event.extra) event.extra = redactDeep(event.extra) as typeof event.extra
  if (event.contexts) event.contexts = redactDeep(event.contexts) as typeof event.contexts

  return event
}
