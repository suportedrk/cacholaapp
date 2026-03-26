// ============================================================
// TIPOS DE PERMISSÕES — Cachola OS
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

export type Action = 'view' | 'create' | 'edit' | 'delete' | 'export'

export interface UserPermission {
  id: string
  user_id: string
  module: Module
  action: Action
  granted: boolean
}

export interface RoleDefaultPermission {
  id: string
  role: Role
  module: Module
  action: Action
  granted: boolean
}

/** Mapa de permissões: module → action → granted */
export type PermissionMap = Record<Module, Record<Action, boolean>>
