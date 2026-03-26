// ============================================================
// DATABASE TYPES — Cachola OS
// Gerado manualmente do schema. Após o banco estar rodando,
// substituir com: npx supabase gen types typescript --local
// ============================================================

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// ─────────────────────────────────────────────────────────────
// DATABASE TYPE (para uso com @supabase/ssr)
// ─────────────────────────────────────────────────────────────
export interface Database {
  public: {
    Tables: {
      users: { Row: User; Insert: UserInsert; Update: UserUpdate; Relationships: [] }
      user_permissions: { Row: UserPermission; Insert: UserPermissionInsert; Update: UserPermissionUpdate; Relationships: [] }
      role_default_perms: { Row: RoleDefaultPerm; Insert: Partial<RoleDefaultPerm>; Update: Partial<RoleDefaultPerm>; Relationships: [] }
      events: { Row: Event; Insert: Partial<Event>; Update: Partial<Event>; Relationships: [] }
      event_staff: { Row: EventStaff; Insert: Partial<EventStaff>; Update: Partial<EventStaff>; Relationships: [] }
      checklist_templates: { Row: ChecklistTemplate; Insert: Partial<ChecklistTemplate>; Update: Partial<ChecklistTemplate>; Relationships: [] }
      template_items: { Row: TemplateItem; Insert: Partial<TemplateItem>; Update: Partial<TemplateItem>; Relationships: [] }
      checklists: { Row: Checklist; Insert: Partial<Checklist>; Update: Partial<Checklist>; Relationships: [] }
      checklist_items: { Row: ChecklistItem; Insert: Partial<ChecklistItem>; Update: Partial<ChecklistItem>; Relationships: [] }
      maintenance_orders: { Row: MaintenanceOrder; Insert: Partial<MaintenanceOrder>; Update: Partial<MaintenanceOrder>; Relationships: [] }
      maintenance_photos: { Row: MaintenancePhoto; Insert: Partial<MaintenancePhoto>; Update: Partial<MaintenancePhoto>; Relationships: [] }
      notifications: { Row: AppNotification; Insert: Partial<AppNotification>; Update: Partial<AppNotification>; Relationships: [] }
      audit_logs: { Row: AuditLog; Insert: Partial<AuditLog>; Update: Partial<AuditLog>; Relationships: [] }
      system_config: { Row: SystemConfig; Insert: Partial<SystemConfig>; Update: Partial<SystemConfig>; Relationships: [] }
    }
    Views: Record<string, never>
    Functions: {
      check_permission: { Args: { p_user_id: string; p_module: string; p_action: string }; Returns: boolean }
      get_user_permissions: { Args: { p_user_id: string }; Returns: Json }
      get_unread_notifications_count: { Args: { p_user_id: string }; Returns: number }
      reload_user_permissions: { Args: { p_user_id: string }; Returns: void }
      mark_all_notifications_read: { Args: { p_user_id: string }; Returns: void }
    }
    Enums: Record<string, never>
  }
}

// ─────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────
export type UserRole =
  | 'super_admin' | 'diretor' | 'gerente' | 'vendedora'
  | 'decoracao' | 'manutencao' | 'financeiro' | 'rh'
  | 'freelancer' | 'entregador'

export type EventStatus = 'draft' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
export type ChecklistStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
export type MaintenanceType = 'correctiva' | 'preventiva' | 'melhoria'
export type MaintenancePriority = 'low' | 'medium' | 'high' | 'critical'
export type MaintenanceStatus = 'open' | 'in_progress' | 'waiting_parts' | 'completed' | 'cancelled'
export type PhotoType = 'before' | 'after' | 'during'

// ─────────────────────────────────────────────────────────────
// TABELAS
// ─────────────────────────────────────────────────────────────
export type User = {
  id: string
  email: string
  name: string
  phone: string | null
  avatar_url: string | null
  role: UserRole
  is_active: boolean
  preferences: {
    notifications: {
      email: boolean
      push: boolean
      events: boolean
      maintenance: boolean
      checklists: boolean
    }
  }
  created_at: string
  updated_at: string
}

export type UserInsert = Omit<Partial<User>, 'preferences'> & { preferences?: Json }
export type UserUpdate = Omit<Partial<User>, 'preferences'> & { preferences?: Json }

export type UserPermission = {
  id: string
  user_id: string
  module: string
  action: string
  granted: boolean
}

export type UserPermissionInsert = Partial<UserPermission>
export type UserPermissionUpdate = Partial<UserPermission>

export type RoleDefaultPerm = {
  id: string
  role: UserRole
  module: string
  action: string
  granted: boolean
}

export type Event = {
  id: string
  ploomes_deal_id: string | null
  title: string
  date: string
  start_time: string
  end_time: string
  event_type: string
  package: string | null
  status: EventStatus
  client_name: string
  birthday_person: string | null
  birthday_age: number | null
  guest_count: number | null
  notes: string | null
  venue: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export type EventStaff = {
  id: string
  event_id: string
  user_id: string
  role_in_event: string
}

export type ChecklistTemplate = {
  id: string
  title: string
  category: string
  created_by: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type TemplateItem = {
  id: string
  template_id: string
  description: string
  sort_order: number
}

export type Checklist = {
  id: string
  title: string
  template_id: string | null
  event_id: string | null
  assigned_to: string | null
  status: ChecklistStatus
  due_date: string | null
  created_at: string
  updated_at: string
}

export type ChecklistItem = {
  id: string
  checklist_id: string
  description: string
  is_done: boolean
  done_by: string | null
  done_at: string | null
  photo_url: string | null
  notes: string | null
  sort_order: number
}

export type MaintenanceOrder = {
  id: string
  title: string
  description: string | null
  type: MaintenanceType
  priority: MaintenancePriority
  sector: string
  equipment: string | null
  status: MaintenanceStatus
  assigned_to: string | null
  due_date: string | null
  event_id: string | null
  recurrence_rule: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export type MaintenancePhoto = {
  id: string
  order_id: string
  url: string
  type: PhotoType
  uploaded_by: string
  created_at: string
}

export type AppNotification = {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  is_read: boolean
  link: string | null
  created_at: string
}

export type AuditLog = {
  id: string
  user_id: string | null
  action: string
  module: string
  entity_id: string | null
  entity_type: string
  old_data: Json | null
  new_data: Json | null
  ip: string | null
  created_at: string
}

export type SystemConfig = {
  id: string
  category: string
  key: string
  label: string
  sort_order: number
  is_active: boolean
}

// ─────────────────────────────────────────────────────────────
// TIPOS COM RELACIONAMENTOS (para queries com join)
// ─────────────────────────────────────────────────────────────
export type EventWithStaff = Event & {
  event_staff: (EventStaff & { user: Pick<User, 'id' | 'name' | 'avatar_url'> })[]
}

export type ChecklistWithItems = Checklist & {
  checklist_items: ChecklistItem[]
  assigned_user: Pick<User, 'id' | 'name' | 'avatar_url'> | null
}

export type MaintenanceOrderWithPhotos = MaintenanceOrder & {
  maintenance_photos: MaintenancePhoto[]
  assigned_user: Pick<User, 'id' | 'name' | 'avatar_url'> | null
}
