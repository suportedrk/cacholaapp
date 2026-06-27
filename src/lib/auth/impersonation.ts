/**
 * Modo "Ver como" (impersonation 2A) — utilitários server-only.
 *
 * SEGURANÇA / DESENHO:
 * - O token de impersonação é um JWT HS256 assinado com SUPABASE_JWT_SECRET, carregando
 *   a identidade do usuário-alvo (`sub`) + um claim custom `impersonator` (id do super_admin
 *   real). O PostgREST aceita esse token e resolve o RLS como o alvo (fidelidade de dados);
 *   o GoTrue o RECUSA (sem sessão real) — por isso ele NÃO substitui a sessão de login.
 * - O read-only é imposto no banco (migrations 175/176/177) via `is_impersonating()`, que
 *   lê justamente o claim `impersonator`. Este arquivo só MINTA e VERIFICA o token.
 * - Sem refresh, TTL curto. O segredo nunca vai ao client (este módulo é server-only).
 *
 * Este módulo NÃO deve ser importado em código client (`'use client'`).
 */

import crypto from 'node:crypto'
import {
  IMPERSONATION_COOKIE,
  IMPERSONATION_ACTIVE_FLAG,
  IMPERSONATION_TTL_SECONDS,
  type ImpersonationClaims,
} from '@/lib/auth/impersonation-constants'

// Re-exporta para os callers server que já importavam destas daqui.
export {
  IMPERSONATION_COOKIE,
  IMPERSONATION_ACTIVE_FLAG,
  IMPERSONATION_TTL_SECONDS,
  type ImpersonationClaims,
}

function jwtSecret(): string {
  const s = process.env.SUPABASE_JWT_SECRET
  if (!s) throw new Error('SUPABASE_JWT_SECRET ausente — impossível mintar token de impersonação.')
  return s
}

const b64url = (input: string): string => Buffer.from(input, 'utf8').toString('base64url')

/**
 * Minta um JWT HS256 com a identidade do alvo + claim `impersonator`. Sem refresh.
 * `nowSeconds` é injetado para testabilidade (use Math.floor(Date.now()/1000) no caller).
 */
export function mintImpersonationToken(params: {
  targetId: string
  targetEmail: string | null
  adminId: string
  nowSeconds: number
}): string {
  const { targetId, targetEmail, adminId, nowSeconds } = params
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = {
    iss: 'supabase',
    aud: 'authenticated',
    role: 'authenticated',
    sub: targetId,
    email: targetEmail ?? '',
    impersonator: adminId,
    iat: nowSeconds,
    exp: nowSeconds + IMPERSONATION_TTL_SECONDS,
  }
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  const sig = crypto.createHmac('sha256', jwtSecret()).update(data).digest('base64url')
  return `${data}.${sig}`
}

/**
 * Verifica assinatura (timing-safe) + expiração e devolve os claims, ou `null` se inválido.
 * NÃO confia em nada além da assinatura própria — um token sem o secret não passa.
 */
export function verifyImpersonationToken(token: string | undefined | null): ImpersonationClaims | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [h, p, sig] = parts

  const expected = crypto.createHmac('sha256', jwtSecret()).update(`${h}.${p}`).digest('base64url')
  const sigBuf = Buffer.from(sig)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'))
  } catch {
    return null
  }

  const sub = payload.sub
  const impersonator = payload.impersonator
  const exp = payload.exp
  const iat = payload.iat
  if (typeof sub !== 'string' || typeof impersonator !== 'string' || typeof exp !== 'number') {
    return null
  }
  if (exp * 1000 <= Date.now()) return null // expirado

  return { sub, impersonator, exp, iat: typeof iat === 'number' ? iat : 0 }
}
