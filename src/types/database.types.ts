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
      users:                { Row: User;                Insert: UserInsert;              Update: UserUpdate;              Relationships: [] }
      user_permissions:     { Row: UserPermission;      Insert: UserPermissionInsert;    Update: UserPermissionUpdate;    Relationships: [] }
      role_default_perms:   { Row: RoleDefaultPerm;     Insert: Partial<RoleDefaultPerm>; Update: Partial<RoleDefaultPerm>; Relationships: [] }
      // Configurações (Fase 1)
      event_types:          { Row: EventType;           Insert: Partial<EventType>;      Update: Partial<EventType>;      Relationships: [] }
      packages:             { Row: Package;             Insert: Partial<Package>;        Update: Partial<Package>;        Relationships: [] }
      venues:               { Row: Venue;               Insert: Partial<Venue>;          Update: Partial<Venue>;          Relationships: [] }
      checklist_categories: { Row: ChecklistCategory;   Insert: Partial<ChecklistCategory>; Update: Partial<ChecklistCategory>; Relationships: [] }
      // Eventos
      events:               { Row: Event;               Insert: EventInsert;             Update: EventUpdate;             Relationships: [] }
      event_staff:          { Row: EventStaff;          Insert: Partial<EventStaff>;     Update: Partial<EventStaff>;     Relationships: [] }
      // Checklists
      checklist_templates:  { Row: ChecklistTemplate;   Insert: Partial<ChecklistTemplate>; Update: Partial<ChecklistTemplate>; Relationships: [] }
      template_items:       { Row: TemplateItem;        Insert: Partial<TemplateItem>;   Update: Partial<TemplateItem>;   Relationships: [] }
      checklists:           { Row: Checklist;           Insert: Partial<Checklist>;      Update: Partial<Checklist>;      Relationships: [] }
      checklist_items:      { Row: ChecklistItem;       Insert: Partial<ChecklistItem>;  Update: Partial<ChecklistItem>;  Relationships: [] }
      // Manutenção
      sectors:              { Row: Sector;              Insert: Partial<Sector>;           Update: Partial<Sector>;           Relationships: [] }
      maintenance_orders:   { Row: MaintenanceOrder;    Insert: Partial<MaintenanceOrder>; Update: Partial<MaintenanceOrder>; Relationships: [] }
      maintenance_photos:   { Row: MaintenancePhoto;    Insert: Partial<MaintenancePhoto>; Update: Partial<MaintenancePhoto>; Relationships: [] }
      // Sistema
      notifications:        { Row: AppNotification;     Insert: Partial<AppNotification>; Update: Partial<AppNotification>; Relationships: [] }
      audit_logs:           { Row: AuditLog;            Insert: Partial<AuditLog>;       Update: Partial<AuditLog>;       Relationships: [] }
      system_config:        { Row: SystemConfig;        Insert: Partial<SystemConfig>;   Update: Partial<SystemConfig>;   Relationships: [] }
    }
    Views: Record<string, never>
    Functions: {
      check_permission:              { Args: { p_user_id: string; p_module: string; p_action: string }; Returns: boolean }
      get_user_permissions:          { Args: { p_user_id: string }; Returns: Json }
      get_unread_notifications_count:{ Args: { p_user_id: string }; Returns: number }
      reload_user_permissions:       { Args: { p_user_id: string }; Returns: void }
      mark_all_notifications_read:   { Args: { p_user_id: string }; Returns: void }
      create_notification:           { Args: { p_user_id: string; p_type: string; p_title: string; p_body: string; p_link?: string | null }; Returns: string }
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

// Fase 1: enum atualizado (migration 006)
// draft→pending, completed→finished, cancelado removido, adding preparing e post_event
export type EventStatus =
  | 'pending'     // Pendente (aguardando confirmação)
  | 'confirmed'   // Confirmado
  | 'preparing'   // Em Preparo (decoração, cozinha etc.)
  | 'in_progress' // Em Andamento (evento acontecendo)
  | 'finished'    // Finalizado
  | 'post_event'  // Pós-Evento (limpeza, devolução, avaliação)

export type ChecklistStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
export type ChecklistItemStatus = 'pending' | 'done' | 'na'
export type MaintenanceType = 'emergency' | 'punctual' | 'recurring'
export type MaintenancePriority = 'low' | 'medium' | 'high' | 'critical'
export type MaintenanceStatus = 'open' | 'in_progress' | 'waiting_parts' | 'completed' | 'cancelled'
export type PhotoType = 'before' | 'after' | 'during'

// ─────────────────────────────────────────────────────────────
// TABELAS DE CONFIGURAÇÃO (Fase 1)
// ─────────────────────────────────────────────────────────────
export type EventType = {
  id: string
  name: string
  is_active: boolean
  sort_order: number
  created_at: string
}

export type Package = {
  id: string
  name: string
  description: string | null
  is_active: boolean
  sort_order: number
  created_at: string
}

export type Venue = {
  id: string
  name: string
  capacity: number | null
  is_active: boolean
  sort_order: number
  created_at: string
}

export type ChecklistCategory = {
  id: string
  name: string
  is_active: boolean
  sort_order: number
  created_at: string
}

// ─────────────────────────────────────────────────────────────
// MANUTENÇÃO — CONFIGURAÇÃO
// ─────────────────────────────────────────────────────────────
export type Sector = {
  id: string
  name: string
  is_active: boolean
  sort_order: number
  created_at: string
}

export type RecurrenceRule = {
  frequency: 'daily' | 'weekly' | 'monthly'
  interval: number                // a cada N dias/semanas/meses
  day_of_week?: number            // 0=dom ... 6=sáb (para weekly)
  day_of_month?: number           // 1-31 (para monthly)
  advance_notice_days: number     // alertar X dias antes
  next_due_date: string           // 'YYYY-MM-DD' — próxima data calculada
}

// ─────────────────────────────────────────────────────────────
// TABELAS DE USUÁRIOS
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

// ─────────────────────────────────────────────────────────────
// EVENTOS (Fase 1: event_type/package/venue viram FKs UUID)
// ─────────────────────────────────────────────────────────────
export type Event = {
  id: string
  ploomes_deal_id: string | null
  title: string
  date: string           // DATE → 'YYYY-MM-DD'
  start_time: string     // TIME → 'HH:MM:SS'
  end_time: string       // TIME → 'HH:MM:SS'
  event_type_id: string | null
  package_id: string | null
  venue_id: string | null
  status: EventStatus
  client_name: string
  birthday_person: string | null
  birthday_age: number | null
  guest_count: number | null
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export type EventInsert = {
  title: string
  date: string
  start_time: string
  end_time: string
  status?: EventStatus
  client_name: string
  birthday_person?: string | null
  birthday_age?: number | null
  guest_count?: number | null
  notes?: string | null
  event_type_id?: string | null
  package_id?: string | null
  venue_id?: string | null
  ploomes_deal_id?: string | null
  created_by: string
}

export type EventUpdate = Partial<Omit<Event, 'id' | 'created_by' | 'created_at' | 'updated_at'>>

export type EventStaff = {
  id: string
  event_id: string
  user_id: string
  role_in_event: string
}

// ─────────────────────────────────────────────────────────────
// CHECKLISTS
// ─────────────────────────────────────────────────────────────
export type ChecklistTemplate = {
  id: string
  title: string
  category: string       // TEXT legado
  category_id: string | null  // FK → checklist_categories (Fase 1, migration 007)
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
  is_done: boolean          // legado — derivado de status
  status: ChecklistItemStatus  // 'pending' | 'done' | 'na' (migration 007)
  done_by: string | null
  done_at: string | null
  photo_url: string | null
  notes: string | null
  sort_order: number
}

// ─────────────────────────────────────────────────────────────
// MANUTENÇÃO
// ─────────────────────────────────────────────────────────────
export type MaintenanceOrder = {
  id: string
  title: string
  description: string | null
  type: MaintenanceType
  priority: MaintenancePriority
  sector_id: string | null
  equipment: string | null
  status: MaintenanceStatus
  assigned_to: string | null
  due_date: string | null
  event_id: string | null
  recurrence_rule: RecurrenceRule | null
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

// ─────────────────────────────────────────────────────────────
// SISTEMA
// ─────────────────────────────────────────────────────────────
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
// TIPOS COM RELACIONAMENTOS (para queries com join/select aninhado)
// ─────────────────────────────────────────────────────────────

// Evento com dados completos para cards e detalhe
export type EventWithDetails = Event & {
  event_type: Pick<EventType, 'id' | 'name'> | null
  package: Pick<Package, 'id' | 'name'> | null
  venue: Pick<Venue, 'id' | 'name' | 'capacity'> | null
  staff: Array<{
    id: string
    role_in_event: string
    user: Pick<User, 'id' | 'name' | 'avatar_url'>
  }>
}

// Checklist com itens completos (tela de preenchimento)
export type ChecklistWithItems = Checklist & {
  checklist_items: ChecklistItem[]
  event: Pick<Event, 'id' | 'title' | 'date'> | null
  assigned_user: Pick<User, 'id' | 'name' | 'avatar_url'> | null
}

// Checklist para listagem (itens apenas com id+status para progresso)
export type ChecklistForList = Checklist & {
  event: Pick<Event, 'id' | 'title' | 'date'> | null
  assigned_user: Pick<User, 'id' | 'name' | 'avatar_url'> | null
  checklist_items: Array<{ id: string; status: ChecklistItemStatus }>
}

// Template com itens e categoria
export type TemplateWithItems = ChecklistTemplate & {
  category: Pick<ChecklistCategory, 'id' | 'name'> | null
  template_items: TemplateItem[]
}

// Manutenção com detalhes completos (tela de detalhe)
export type MaintenanceWithDetails = MaintenanceOrder & {
  sector: Pick<Sector, 'id' | 'name'> | null
  assigned_user: Pick<User, 'id' | 'name' | 'avatar_url'> | null
  creator: Pick<User, 'id' | 'name' | 'avatar_url'> | null
  event: Pick<Event, 'id' | 'title' | 'date'> | null
  maintenance_photos: MaintenancePhoto[]
}

// Manutenção para listagem (sem fotos inline)
export type MaintenanceForList = MaintenanceOrder & {
  sector: Pick<Sector, 'id' | 'name'> | null
  assigned_user: Pick<User, 'id' | 'name' | 'avatar_url'> | null
  photo_count: number  // calculado no client
}
