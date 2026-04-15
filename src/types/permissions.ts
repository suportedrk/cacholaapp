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

export type Module =
  | 'events'
  | 'maintenance'
  | 'checklists'
  | 'users'
  | 'reports'
  | 'audit_logs'
  | 'notifications'
  | 'settings'
  | 'providers'
  | 'minutes'

export type Action = 'view' | 'create' | 'edit' | 'delete' | 'export'

/** Mapa de permissões: module → action → granted */
export type PermissionMap = Record<Module, Record<Action, boolean>>
