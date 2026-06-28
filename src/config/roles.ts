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
import type { UserRole } from '@/types/database.types'
import { ROLE_LABELS } from '@/lib/constants'

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
 * Cadastra/edita metas de venda (sales_targets). Decisão de produto: só diretoria.
 * Intencionalmente SEM gerente (que vê dados em VENDAS_MANAGE_ROLES, mas não define metas
 * e nem acessa /vendas — sem vendas:view). Gate da API e da UI das metas.
 */
export const VENDAS_TARGETS_MANAGE_ROLES = [
  'super_admin',
  'diretor',
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

/**
 * Cargos para os quais a unidade é OPCIONAL na criação do usuário.
 * São cargos de visão global (veem todas as unidades), então não precisam
 * nascer vinculados a uma unidade específica. Todo cargo FORA desta lista é
 * operacional e exige ao menos 1 unidade ao ser criado — sem isso o usuário
 * cai em estado indeterminado de unidade no boot (ver UNIT STORE no CLAUDE.md).
 * Decisão de produto (Bruno, 26/06/2026): apenas super_admin + diretor.
 */
export const UNIT_OPTIONAL_AT_CREATION_ROLES = [
  'super_admin',
  'diretor',
] as const satisfies readonly Role[]

/**
 * "Diretoria" — super_admin + diretor APENAS (sem pos_vendas).
 * Espelha a função SQL `is_diretoria()` (migration 153). Usada no modelo de
 * visibilidade do módulo Atas: diretoria edita atas gerais, duplica como geral
 * e exclui atas de terceiros. Distinta de GLOBAL_VIEWER_ROLES (que inclui
 * pos_vendas) e de ADMIN_ACCESS_ROLES (que nomeia acesso à área /admin).
 */
export const DIRETORIA_ROLES = [
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
  'operacional',
  'operacional_eventos',
] as const satisfies readonly Role[]

/**
 * Visibilidade do item de MENU "Equipamentos" (sub-item de Manutenção).
 * Separado de MAINTENANCE_MODULE_ROLES porque os cargos operacionais veem
 * Manutenção/Chamados/Minhas Tarefas mas NÃO Equipamentos (não têm
 * `equipamentos.view` no template — o item apareceria e cairia em /403).
 * Mantém o conjunto original de MAINTENANCE_MODULE_ROLES antes da v1.44.0.
 */
export const EQUIPAMENTOS_MENU_ROLES = [
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
 * Acesso à Agenda de Manutenção (rota /manutencao/agenda).
 * Estende MAINTENANCE_ADMIN_ROLES adicionando `operacional_eventos`, que precisa de
 * leitura read-only da agenda sem ter acesso a Dashboard ou Configurações
 * (que continuam protegidos por MAINTENANCE_ADMIN_ROLES).
 */
export const MAINTENANCE_AGENDA_ROLES = [
  ...MAINTENANCE_ADMIN_ROLES,
  'operacional_eventos',
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
  'operacional',
  'operacional_eventos',
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
// Módulo Decoração (/decoracao)
// ──────────────────────────────────────────────────────────────

/**
 * Acesso ao módulo Decoração — ver, criar e editar temas e cores de forminha.
 * Usado no guard de layout, na sidebar e nas API routes de POST/PATCH.
 * Exclusão permanente é restrita — ver DECORACAO_DELETE_ROLES.
 */
export const DECORACAO_MANAGE_ROLES = [
  'super_admin',
  'diretor',
  'gerente',
  'decoracao',
] as const satisfies readonly Role[]

/**
 * Pode EXCLUIR temas e cores de forminha de forma permanente.
 * gerente e decoracao não excluem — usam o toggle ativo/inativo para
 * aposentar um tema ou cor sem apagar.
 */
export const DECORACAO_DELETE_ROLES = [
  'super_admin',
  'diretor',
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
  'operacional_eventos',
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
  'operacional',
  'operacional_eventos',
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
  'operacional',
  'operacional_eventos',
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
 * Roles que podem acessar módulos marcados como "Em breve" (comingSoon: true na nav).
 * Todos os outros cargos que enxergam o item veem-no desabilitado com a plaquinha "Em breve".
 */
export const COMING_SOON_BYPASS_ROLES = [
  'super_admin',
  'diretor',
] as const satisfies readonly Role[]

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

// ──────────────────────────────────────────────────────────────
// Permissões de Valor (Frente Permissões de Valor v1.11.0)
// ──────────────────────────────────────────────────────────────

/**
 * Roles que podem visualizar valores monetários de festa:
 * deal_amount, payment_method e campos derivados em RPCs de BI/Vendas.
 * Roles BLOQUEADAS (não listadas): manutencao, rh, freelancer, entregador.
 * Espelha a função SQL can_view_festa_values() em migration 093.
 * Ao alterar este conjunto, atualizar também a migration correspondente.
 */
export const ROLES_CAN_VIEW_FESTA_VALUES = [
  'super_admin',
  'diretor',
  'gerente',
  'vendedora',
  'pos_vendas',
  'decoracao',
  'financeiro',
  'operacional_eventos',
] as const satisfies readonly Role[]

/**
 * Helper direto para verificar se um role pode ver valores monetários de festa.
 * Usar em componentes React no lugar de hasRole(..., ROLES_CAN_VIEW_FESTA_VALUES)
 * para tornar a intenção explícita nos call sites.
 */
export function canViewFestaValues(role: Role | null | undefined): boolean {
  if (!role) return false
  return (ROLES_CAN_VIEW_FESTA_VALUES as readonly string[]).includes(role)
}

/**
 * Roles que podem visualizar o CUSTO de prestador (event_providers.agreed_price) —
 * quanto pagamos ao fornecedor, dado financeiro sensível, distinto do valor de festa
 * (quanto cobramos do cliente). Gestão + financeiro + os cargos OPERACIONAIS que
 * contratam/coordenam prestadores e negociam o preço (manutencao, decoracao) —
 * estes precisam ver o valor que eles mesmos definem (resolve a assimetria "escreve
 * mas não vê"). BLOQUEADAS: vendedora e pos_vendas (vendas — não lidam com custo de
 * fornecedor) + rh/freelancer/entregador (sem acesso a Prestadores). Exibe "Restrito".
 * Gate de exibição no frontend (sem espelho em SQL hoje); ajustar aqui se necessário.
 */
export const ROLES_CAN_VIEW_PROVIDER_COST = [
  'super_admin',
  'diretor',
  'gerente',
  'financeiro',
  'manutencao',
  'decoracao',
] as const satisfies readonly Role[]

/**
 * Helper direto para verificar se um role pode ver o custo de prestador.
 * Usar em componentes React para tornar a intenção explícita nos call sites.
 */
export function canViewProviderCost(role: Role | null | undefined): boolean {
  if (!role) return false
  return (ROLES_CAN_VIEW_PROVIDER_COST as readonly string[]).includes(role)
}

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

/**
 * Catálogo de cargos atribuíveis (fonte de verdade: ROLE_LABELS).
 * Derivado aqui para que a allowlist anti mass-assignment tenha um único ponto.
 */
export const VALID_ASSIGNABLE_ROLES = Object.keys(ROLE_LABELS) as UserRole[]

/**
 * Valida, em runtime, um `role` recebido do cliente antes de gravá-lo/aplicá-lo
 * a um usuário. Resolve dois riscos (A01/A08 — mass-assignment):
 *  1. `role` é apagado no build (tipo TS) → qualquer string injetada no body
 *     entraria sem validação. Aqui checamos contra o catálogo.
 *  2. Menor privilégio: cargo de sistema (super_admin) só pode ser atribuído
 *     por quem já é super_admin (espelha SYSTEM_ONLY_ROLES).
 *
 * Fonte única reutilizada por POST /api/admin/users, .../change-role e
 * .../apply-role-template. Em sucesso, devolve o role já estreitado p/ UserRole.
 */
export function assertAssignableRole(
  role: string | null | undefined,
  actorRole: Role | null | undefined,
): { ok: true; role: UserRole } | { ok: false; error: string; status: number } {
  if (!role || !(VALID_ASSIGNABLE_ROLES as readonly string[]).includes(role)) {
    return { ok: false, error: 'Cargo inválido.', status: 400 }
  }
  if (hasRole(role as Role, SYSTEM_ONLY_ROLES) && !hasRole(actorRole, SYSTEM_ONLY_ROLES)) {
    return {
      ok: false,
      error: 'Apenas um Super Admin pode atribuir o cargo Super Admin.',
      status: 403,
    }
  }
  return { ok: true, role: role as UserRole }
}
