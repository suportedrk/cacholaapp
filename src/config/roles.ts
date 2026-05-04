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
 *   vendedora   | pos_vendas | decoracao | rh | freelancer | entregador
 */

import type { Role } from '@/types/permissions'

/** Acesso a qualquer aba do módulo BI (sidebar + página /bi) e Relatórios. */
export const BI_ACCESS_ROLES = [
  'super_admin',
  'diretor',
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

/** Acesso ao módulo Vendas (/vendas) — vendedoras + diretoria + pós-vendas. */
export const VENDAS_MODULE_ROLES = [
  'super_admin',
  'diretor',
  'vendedora',
  'pos_vendas',
] as const satisfies readonly Role[]

/** Vê dados de TODAS as vendedoras (não apenas os próprios). */
export const VENDAS_MANAGE_ROLES = [
  'super_admin',
  'diretor',
  'gerente',
] as const satisfies readonly Role[]

/**
 * Gestão do Checklist Comercial: criar/editar templates, ver Equipe Comercial e Automações.
 * A partir de v1.5.0 restrito a super_admin + diretor — gerente removido.
 */
export const COMMERCIAL_CHECKLIST_MANAGE_ROLES = [
  'super_admin',
  'diretor',
] as const satisfies readonly Role[]

/**
 * Acesso ao Checklist Comercial (/vendas/checklist > Minhas Tarefas).
 * A partir de v1.5.0: gerente removido; pos_vendas adicionado como consumidor.
 */
export const COMMERCIAL_CHECKLIST_ACCESS_ROLES = [
  'super_admin',
  'diretor',
  'vendedora',
  'pos_vendas',
] as const satisfies readonly Role[]

/** Pode arquivar/reativar templates do checklist comercial. */
export const COMMERCIAL_CHECKLIST_ARCHIVE_ROLES = [
  'super_admin',
  'diretor',
] as const satisfies readonly Role[]

// ──────────────────────────────────────────────────────────────
// Visibilidade multi-unidade
// ──────────────────────────────────────────────────────────────

/**
 * Roles que podem selecionar "Todas as unidades" no UnitSwitcher
 * e visualizar dados consolidados (activeUnitId = null).
 * Fonte única de verdade — não duplicar em componentes.
 */
export const GLOBAL_VIEWER_ROLES = [
  'super_admin',
  'diretor',
  'pos_vendas',
] as const satisfies readonly Role[]

// ──────────────────────────────────────────────────────────────
// Administração (/admin/**)
// ──────────────────────────────────────────────────────────────

/** Acesso à área /admin (pai comum). */
export const ADMIN_ACCESS_ROLES = [
  'super_admin',
  'diretor',
] as const satisfies readonly Role[]

/** Gestão de usuários (/admin/usuarios) — criar, editar, permissões, reenviar convite. */
export const ADMIN_USERS_MANAGE_ROLES = [
  'super_admin',
  'diretor',
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
 */
export const MAINTENANCE_MODULE_ROLES = [
  'super_admin',
  'diretor',
  'gerente',
  'manutencao',
] as const satisfies readonly Role[]

/**
 * Acesso a sub-rotas de gestão em Manutenção: Dashboard e Configurações.
 * Exclui `manutencao` — técnicos não precisam dessas visões gerenciais.
 */
export const MAINTENANCE_ADMIN_ROLES = [
  'super_admin',
  'diretor',
  'gerente',
] as const satisfies readonly Role[]

/**
 * Acesso ao módulo de Prestadores (gestão de terceiros).
 * Exclui rh, freelancer, entregador — sem necessidade operacional nesse módulo.
 */
export const PRESTADORES_ACCESS_ROLES = [
  'super_admin',
  'diretor',
  'gerente',
  'financeiro',
  'manutencao',
  'vendedora',
  'pos_vendas',
  'decoracao',
] as const satisfies readonly Role[]

/**
 * Roles que recebem notificações sobre prestadores (adições, mudanças de status,
 * documentos vencendo/vencidos, avaliações pendentes).
 *
 * Coincide hoje com MAINTENANCE_ADMIN_ROLES, mas é intencionalmente uma constante
 * separada: prestadores e manutenção são módulos com evolução independente.
 * NÃO consolidar com MAINTENANCE_ADMIN_ROLES sem revisão de produto.
 */
export const PROVIDER_NOTIFY_ROLES = [
  'super_admin',
  'diretor',
  'gerente',
] as const satisfies readonly Role[]

/**
 * Roles com acesso ao módulo de Checklist Operacional
 * (/checklists e /checklists/minhas-tarefas).
 * v1.5.0 reduziu para 4 roles. v1.5.1 restaurou freelancer e entregador porque o
 * fluxo operacional desses roles é checklist/tarefas do dia. Continuam fora:
 * vendedora, rh, financeiro, manutencao (trabalho não é checklist operacional de festa).
 */
export const OPERATIONAL_CHECKLIST_ROLES = [
  'super_admin',
  'diretor',
  'gerente',
  'decoracao',
  'freelancer',
  'entregador',
] as const satisfies readonly Role[]

/**
 * Roles que veem "Tarefas da Equipe" no Checklist Operacional.
 * decoracao/freelancer/entregador estão em OPERATIONAL_CHECKLIST_ROLES mas NÃO veem Tarefas da Equipe.
 */
export const TEAM_TASKS_ROLES = [
  'super_admin',
  'diretor',
  'gerente',
] as const satisfies readonly Role[]

// ──────────────────────────────────────────────────────────────
// Módulos de acesso geral
// ──────────────────────────────────────────────────────────────

/**
 * Acesso ao módulo de Eventos (/eventos).
 * Exclui manutencao, freelancer, entregador — sem contexto de festa.
 */
export const EVENTOS_ACCESS_ROLES = [
  'super_admin',
  'diretor',
  'gerente',
  'financeiro',
  'vendedora',
  'pos_vendas',
  'decoracao',
  'rh',
] as const satisfies readonly Role[]

/**
 * Acesso ao módulo de Atas (/atas).
 * Exclui manutencao, freelancer, entregador.
 */
export const ATAS_ACCESS_ROLES = [
  'super_admin',
  'diretor',
  'gerente',
  'financeiro',
  'vendedora',
  'pos_vendas',
  'decoracao',
  'rh',
] as const satisfies readonly Role[]

/**
 * Roles que podem criar, editar e excluir atas.
 * Subset de ATAS_ACCESS_ROLES — quem gerencia é também quem acessa.
 */
export const ATAS_MANAGE_ROLES = [
  'super_admin',
  'diretor',
  'gerente',
] as const satisfies readonly Role[]

/**
 * Acesso ao Dashboard principal (/dashboard).
 * Exclui freelancer e entregador — redirecionados para /checklists/minhas-tarefas.
 */
export const DASHBOARD_ACCESS_ROLES = [
  'super_admin',
  'diretor',
  'gerente',
  'financeiro',
  'manutencao',
  'vendedora',
  'pos_vendas',
  'decoracao',
  'rh',
] as const satisfies readonly Role[]

// ──────────────────────────────────────────────────────────────
// Configurações
// ──────────────────────────────────────────────────────────────

/**
 * Acesso a configurações (/configuracoes, Regras de Negócio).
 * Restrito a super_admin e diretor — gerente removido em v1.5.1.
 */
export const SETTINGS_ROLES = [
  'super_admin',
  'diretor',
] as const satisfies readonly Role[]

/**
 * Roles que veem o card de onboarding "Setup Inicial" no Início e têm acesso
 * aos checks de progresso de configuração da unidade.
 *
 * Conjunto coincide hoje com MAINTENANCE_ADMIN_ROLES, mas é intencionalmente
 * separado: onboarding evolui independente do módulo de manutenção.
 */
export const ONBOARDING_VIEW_ROLES = [
  'super_admin',
  'diretor',
  'gerente',
] as const satisfies readonly Role[]

/** Gestão de templates de permissão em /admin/cargos. Restrito a super_admin. */
export const TEMPLATE_MANAGE_ROLES = [
  'super_admin',
] as const satisfies readonly Role[]

// ──────────────────────────────────────────────────────────────
// Constantes de uso especializado
// ──────────────────────────────────────────────────────────────

/**
 * Roles autorizadas a impersonar outros usuários ("Ver como") para suporte e auditoria.
 * Hoje só super_admin; pode crescer no futuro (ex: diretor para auditoria).
 * Semanticamente diferente de SYSTEM_ONLY_ROLES — não consolidar sem revisão de produto.
 */
export const IMPERSONATION_ROLES = [
  'super_admin',
] as const satisfies readonly Role[]

/**
 * Roles que operam via app mobile dedicado, fora do dashboard interno.
 * Usadas para roteamento pós-login (redirect para /checklists/minhas-tarefas)
 * e back-link em /403.
 */
export const OPERATIONAL_MOBILE_ROLES = [
  'freelancer',
  'entregador',
] as const satisfies readonly Role[]

/**
 * Roles que existem no catálogo mas NÃO podem ser atribuídas via UI de gestão
 * de equipe (singleton técnico do sistema).
 * Semanticamente diferente de IMPERSONATION_ROLES — não consolidar sem revisão.
 */
export const SYSTEM_ONLY_ROLES = [
  'super_admin',
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
