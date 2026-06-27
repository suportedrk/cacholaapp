// POST /api/csp-report — coletor de violações da CSP (Content-Security-Policy).
//
// A CSP está em modo Report-Only (ver next.config.ts): não bloqueia nada, só
// reporta. As diretivas `report-uri`/`report-to` apontam para cá. O browser
// posta SEM autenticação (o proxy libera /api/), então o endpoint é público e
// write-only: parseia o report, REDIGE PII (LGPD — buffet infantil) e encaminha
// um resumo ao Sentry (agregação em prod) + console.warn (dev/pm2). Sempre 204.
import { NextResponse } from 'next/server'
import { redactDeep } from '@/lib/observability/scrub-pii'

// COLETA via console.warn (NÃO importar @sentry/nextjs aqui): importar o SDK do
// Sentry num route handler trava a compilação on-demand do turbopack em dev. O
// resto do app usa Sentry via instrumentation.ts/sentry.server.ts, não por import
// em route. Em produção, o console.warn cai nos logs do PM2 (greppável por
// `[csp-report]`) — coleta central suficiente para tunar a CSP antes do enforce.
// Encaminhar ao Sentry, se desejado, exige um mecanismo fora do route handler.

// Anti-abuso: o endpoint é público. Limita o corpo e o nº de reports por request.
const MAX_BODY_BYTES = 16 * 1024 // 16 KB
const MAX_REPORTS_PER_REQUEST = 10

// Campos de URL do report que podem carregar PII na query string — guardamos só
// origin+path (sem `?...#...`). Vale para os dois formatos (report-uri/report-to).
const URL_FIELDS = [
  'document-uri',
  'documentURL',
  'blocked-uri',
  'blockedURL',
  'source-file',
  'sourceFile',
  'referrer',
] as const

function stripUrl(value: unknown): unknown {
  if (typeof value !== 'string' || value === '') return value
  // Valores especiais da CSP (ex.: 'inline', 'eval', 'self') passam intactos.
  if (!value.includes('://') && !value.startsWith('/')) return value
  try {
    const u = new URL(value, 'https://placeholder.invalid')
    // Reconstrói sem search/hash. Para URLs relativas devolve só o pathname.
    return value.includes('://') ? `${u.origin}${u.pathname}` : u.pathname
  } catch {
    return value.split('?')[0].split('#')[0]
  }
}

type Violation = Record<string, unknown>

/** Normaliza os dois formatos de report para uma lista de violações cruas. */
function extractViolations(parsed: unknown): Violation[] {
  // report-uri: { "csp-report": { ... } }
  if (parsed && typeof parsed === 'object' && 'csp-report' in parsed) {
    const r = (parsed as Record<string, unknown>)['csp-report']
    return r && typeof r === 'object' ? [r as Violation] : []
  }
  // report-to: [ { type: 'csp-violation', body: { ... } }, ... ]
  if (Array.isArray(parsed)) {
    return parsed
      .filter((it) => it && typeof it === 'object')
      .map((it) => {
        const obj = it as Record<string, unknown>
        const body = obj.body
        return (body && typeof body === 'object' ? body : obj) as Violation
      })
  }
  return []
}

/** Resumo seguro: strip de query em campos de URL + redação profunda por chave. */
function sanitizeViolation(v: Violation): Violation {
  const out: Violation = {}
  for (const [k, val] of Object.entries(v)) {
    out[k] = URL_FIELDS.includes(k as (typeof URL_FIELDS)[number]) ? stripUrl(val) : val
  }
  return redactDeep(out) as Violation
}

function hostOf(value: unknown): string {
  if (typeof value !== 'string' || !value.includes('://')) return 'inline'
  try {
    return new URL(value).host || 'inline'
  } catch {
    return 'inline'
  }
}

export async function POST(req: Request) {
  try {
    // Teto de tamanho via Content-Length (barato) — corpo grande é descartado.
    const len = Number(req.headers.get('content-length') ?? 0)
    if (len > MAX_BODY_BYTES) return new NextResponse(null, { status: 204 })

    const raw = await req.text()
    if (!raw || raw.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 204 })

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return new NextResponse(null, { status: 204 })
    }

    const violations = extractViolations(parsed).slice(0, MAX_REPORTS_PER_REQUEST)

    for (const v of violations) {
      const safe = sanitizeViolation(v)
      const directive =
        (safe['effective-directive'] as string) ||
        (safe['effectiveDirective'] as string) ||
        (safe['violated-directive'] as string) ||
        (safe['violatedDirective'] as string) ||
        'unknown'
      // Deriva do objeto JÁ sanitizado e neutraliza CRLF/tab antes de logar
      // (anti log-injection — directive vem do report, controlado pelo cliente).
      const blockedHost = hostOf(safe['blocked-uri'] ?? safe['blockedURL'])
      const clean = (s: unknown) => String(s ?? '').replace(/[\r\n\t]+/g, ' ').slice(0, 120)

      // Coleta: cai nos logs do PM2 em prod (greppável por `[csp-report]`).
      // JSON.stringify escapa control chars do payload; directive/host limpos acima.
      console.warn('[csp-report]', clean(directive), clean(blockedHost), JSON.stringify(safe))
    }

    return new NextResponse(null, { status: 204 })
  } catch {
    // Nunca devolve erro ao browser — coleta é best-effort.
    return new NextResponse(null, { status: 204 })
  }
}
