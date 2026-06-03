// ============================================================
// TIPOS DE PERMISSÕES — Cachola OS
// Os tipos de linha (UserPermission, RoleDefaultPerm) estão em database.types.ts
// ============================================================

export type Role =
  | 'super_admin'
  | 'diretor'
  | 'gerente'
  | 'vendedora'
  | 'decoracao'
  | 'manutencao'
  | 'financeiro'
  | 'rh'
  | 'freelancer'
  | 'entregador'
  | 'pos_vendas'
  | 'operacional'
  | 'operacional_eventos'

export type Module =
  | 'dashboard'
  | 'bi'
  | 'bi_atendimento'
  | 'bi_vendas'
  | 'vendas'
  | 'checklist_comercial'
  | 'eventos'
  | 'checklists'
  | 'manutencao'
  | 'equipamentos'
  | 'prestadores'
  | 'decoracao'
  | 'atas'
  | 'relatorios'
  | 'usuarios'
  | 'unidades'
  | 'logs'
  | 'backups'
  | 'vendedoras'
  | 'configuracoes'
  | 'notificacoes'
  | 'central_servicos'

export type Action = 'view' | 'create' | 'edit' | 'delete' | 'export' | 'approve'

/** Mapa de permissões: module → action → granted */
export type PermissionMap = Record<Module, Record<Action, boolean>>
