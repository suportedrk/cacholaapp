/**
 * Constantes e tipos do modo "Ver como" (impersonation 2A) — SEM dependências server-only.
 *
 * Vive separado de `impersonation.ts` (que importa `node:crypto`) para poder ser importado
 * tanto por código server quanto por client (ex.: providers.tsx) sem puxar `node:crypto`
 * para o bundle do browser.
 */

/** Cookie httpOnly que carrega o token de impersonação (lido pelos guards SSR). */
export const IMPERSONATION_COOKIE = 'cachola-impersonation'

/**
 * Cookie companheiro NÃO-httpOnly (valor '1') — flag legível pelo JS para o boot decidir se
 * vale chamar a re-hidratação. Não é segredo (o token real fica no cookie httpOnly acima).
 */
export const IMPERSONATION_ACTIVE_FLAG = 'cachola-imp-active'

/** Janela de validade do modo "Ver como" (segundos). Curta de propósito. */
export const IMPERSONATION_TTL_SECONDS = 30 * 60 // 30 min

export interface ImpersonationClaims {
  /** id do usuário-alvo (o que está sendo visualizado) */
  sub: string
  /** id do super_admin real que iniciou o "Ver como" */
  impersonator: string
  exp: number
  iat: number
}
