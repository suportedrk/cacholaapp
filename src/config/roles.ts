/**
 * Fonte única de verdade para controle de acesso por role no módulo BI
 * e em rotas de configuração relacionadas.
 *
 * REGRA: qualquer novo gating de role para BI / vendedoras deve IMPORTAR
 * daqui, nunca definir array local ad-hoc.
 *
 * Outros conjuntos de roles (manutenção, admin de usuários, atas etc.)
 * ainda vivem em seus arquivos — ver Débito 3 para consolidação completa.
 *
 * Roles disponíveis no Cachola OS:
 *   super_admin | diretor | gerente | financeiro | manutencao
 *   vendedora   | decoracao | rh | freelancer | entregador
 */

import type { Role } from '@/types/permissions'

/** Acesso a qualquer aba do módulo BI (sidebar + página /bi). */
export const BI_ACCESS_ROLES = [
  'super_admin',
  'diretor',
  'gerente',
  'financeiro',
] as const satisfies readonly Role[]

/** Acesso à aba "Atendimento (Deals)" — visão mais restrita. */
export const BI_ATENDIMENTO_ROLES = [
  'super_admin',
  'diretor',
] as const satisfies readonly Role[]

/** Acesso à aba "Vendas Realizadas (Orders)" e painel de categorias. */
export const BI_VENDAS_ROLES = [
  'super_admin',
  'diretor',
  'gerente',
  'financeiro',
] as const satisfies readonly Role[]

/** Gestão (CRUD) de vendedoras em /configuracoes/vendedoras. */
export const SELLERS_MANAGE_ROLES = [
  'super_admin',
  'diretor',
] as const satisfies readonly Role[]

/**
 * Helper type-safe: verifica se um role pertence a uma lista readonly.
 *
 * @example
 *   if (hasRole(profile?.role, BI_VENDAS_ROLES)) { ... }
 */
export function hasRole<T extends readonly Role[]>(
  role: Role | null | undefined,
  allowed: T,
): role is T[number] {
  return !!role && (allowed as readonly Role[]).includes(role)
}
