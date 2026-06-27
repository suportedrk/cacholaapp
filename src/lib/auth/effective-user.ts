import { useAuthReadyStore } from '@/stores/auth-store'
import { useImpersonateStore } from '@/stores/impersonate-store'

/**
 * Id do usuário "efetivo" para mutations client-side, lido de forma SÍNCRONA dos stores
 * (sem rede, sem GoTrue):
 * - modo "Ver como" ativo → id do usuário-ALVO (a escrita é bloqueada no banco/API de
 *   qualquer forma; usar o id do alvo mantém a semântica de "agindo como");
 * - caso normal → id do usuário real da sessão.
 *
 * Substitui o anti-padrão `await supabase.auth.getUser()` dentro de hooks (CLAUDE.md), que
 * além de adquirir lock de auth FALHA no client de dados impersonado (token sem sessão GoTrue).
 */
export function getEffectiveUserId(): string | null {
  const imp = useImpersonateStore.getState()
  if (imp.isImpersonating) return imp.impersonatedProfile?.id ?? null
  return useAuthReadyStore.getState().user?.id ?? null
}

/**
 * Mesma resolução de `getEffectiveUserId`, mas devolvendo `{ id } | null` — drop-in para os
 * call sites que faziam `const { data: { user } } = await supabase.auth.getUser()` e depois
 * usam `user.id` / `if (!user)`. Permite a troca de UMA linha, preservando o resto.
 */
export function getEffectiveUser(): { id: string } | null {
  const id = getEffectiveUserId()
  return id ? { id } : null
}
