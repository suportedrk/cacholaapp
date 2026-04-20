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

/** Identifica o role de vendedora (para checks de vinculação seller_id). */
export const VENDEDORA_ROLES = [
  'vendedora',
] as const satisfies readonly Role[]

/** Acesso ao módulo Vendas (/vendas) — vendedoras + gestão. */
export const VENDAS_MODULE_ROLES = [
  'super_admin',
  'diretor',
  'gerente',
  'vendedora',
] as const satisfies readonly Role[]

/** Vê dados de TODAS as vendedoras (não apenas os próprios). */
export const VENDAS_MANAGE_ROLES = [
  'super_admin',
  'diretor',
  'gerente',
] as const satisfies readonly Role[]

/** Gestão de templates e tarefas do checklist comercial (criar/editar). */
export const COMMERCIAL_CHECKLIST_MANAGE_ROLES = [
  'super_admin',
  'diretor',
  'gerente',
] as const satisfies readonly Role[]

/** Acesso ao checklist comercial (gestão + vendedoras). */
export const COMMERCIAL_CHECKLIST_ACCESS_ROLES = [
  'super_admin',
  'diretor',
  'gerente',
  'vendedora',
] as const satisfies readonly Role[]

/** Pode arquivar/reativar templates do checklist comercial (gerente pode criar mas não arquivar). */
export const COMMERCIAL_CHECKLIST_ARCHIVE_ROLES = [
  'super_admin',
  'diretor',
] as const satisfies readonly Role[]

// ──────────────────────────────────────────────────────────────
// Administração (/admin/**)
// ──────────────────────────────────────────────────────────────

/** Acesso à área /admin (pai comum). */
export const ADMIN_ACCESS_ROLES = [
  'super_admin',
  'diretor',
  'rh',
] as const satisfies readonly Role[]

/** Gestão de usuários (/admin/usuarios). */
export const ADMIN_USERS_MANAGE_ROLES = [
  'super_admin',
  'rh',
] as const satisfies readonly Role[]

/** Gestão de unidades (/admin/unidades). */
export const ADMIN_UNITS_MANAGE_ROLES = [
  'super_admin',
  'diretor',
] as const satisfies readonly Role[]

/** Visualização de logs (/admin/logs). */
export const ADMIN_LOGS_VIEW_ROLES = [
  'super_admin',
  'diretor',
] as const satisfies readonly Role[]

/** Visualização do dashboard de backups (/admin/backups). Exclui rh intencionalmente. */
export const BACKUP_VIEW_ROLES = [
  'super_admin',
  'diretor',
] as const satisfies readonly Role[]

// ──────────────────────────────────────────────────────────────
// Módulos Operacionais (/manutencao, /equipamentos, /prestadores)
// ──────────────────────────────────────────────────────────────

/**
 * Acesso aos módulos de Manutenção e Equipamentos.
 * Inclui a role `manutencao` (técnicos internos).
 * /relatorios reutiliza BI_ACCESS_ROLES (super_admin, diretor, gerente, financeiro).
 */
export const MAINTENANCE_MODULE_ROLES = [
  'super_admin',
  'diretor',
  'gerente',
  'manutencao',
] as const satisfies readonly Role[]

/**
 * Acesso ao módulo de Prestadores (gestão de terceiros).
 * Exclui `manutencao` intencionalmente — prestadores externos são responsabilidade
 * de gestão, não dos técnicos operacionais.
 */
export const PRESTADORES_ACCESS_ROLES = [
  'super_admin',
  'diretor',
  'gerente',
] as const satisfies readonly Role[]

export type CommercialChecklistManageRole =
  (typeof COMMERCIAL_CHECKLIST_MANAGE_ROLES)[number]

export type CommercialChecklistAccessRole =
  (typeof COMMERCIAL_CHECKLIST_ACCESS_ROLES)[number]

export type CommercialChecklistArchiveRole =
  (typeof COMMERCIAL_CHECKLIST_ARCHIVE_ROLES)[number]

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
