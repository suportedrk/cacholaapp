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
      // Multi-unidade (Fase 2.5)
      units:                { Row: Unit;                Insert: Partial<Unit>;           Update: Partial<Unit>;           Relationships: [] }
      user_units:           { Row: UserUnit;            Insert: Partial<UserUnit>;       Update: Partial<UserUnit>;       Relationships: [] }
      // Usuários
      users:                { Row: User;                Insert: UserInsert;              Update: UserUpdate;              Relationships: [] }
      user_permissions:     { Row: UserPermission;      Insert: UserPermissionInsert;    Update: UserPermissionUpdate;    Relationships: [] }
      role_default_perms:   { Row: RoleDefaultPerm;     Insert: Partial<RoleDefaultPerm>; Update: Partial<RoleDefaultPerm>; Relationships: [] }
      // Configurações (por unidade — Fase 2.5)
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
      equipment:            { Row: Equipment;           Insert: Partial<Equipment>;        Update: Partial<Equipment>;        Relationships: [] }
      maintenance_photos:   { Row: MaintenancePhoto;    Insert: Partial<MaintenancePhoto>; Update: Partial<MaintenancePhoto>; Relationships: [] }
      // Configurações avançadas (Fase 3)
      unit_settings:        { Row: UnitSettings;        Insert: Partial<UnitSettings>;   Update: Partial<UnitSettings>;   Relationships: [] }
      equipment_categories: { Row: EquipmentCategory;   Insert: Partial<EquipmentCategory>; Update: Partial<EquipmentCategory>; Relationships: [] }
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
      // ── Relatórios (Fase 3) ──────────────────────────────────────────
      report_events_summary:         { Args: { p_unit_id?: string | null; p_from?: string; p_to?: string }; Returns: { total_events: number; avg_guests: number; top_event_type: string | null; top_venue: string | null }[] }
      report_events_by_month:        { Args: { p_unit_id?: string | null; p_from?: string; p_to?: string }; Returns: { month: string; status: string; count: number }[] }
      report_events_by_type:         { Args: { p_unit_id?: string | null; p_from?: string; p_to?: string }; Returns: { type_name: string; count: number }[] }
      report_events_by_venue:        { Args: { p_unit_id?: string | null; p_from?: string; p_to?: string }; Returns: { venue_name: string; count: number }[] }
      report_maintenance_summary:    { Args: { p_unit_id?: string | null; p_from?: string; p_to?: string }; Returns: { total_open: number; total_completed: number; avg_resolution_days: number | null; top_sector: string | null }[] }
      report_maintenance_by_month:   { Args: { p_unit_id?: string | null; p_from?: string; p_to?: string }; Returns: { month: string; open_count: number; completed_count: number }[] }
      report_maintenance_by_sector:  { Args: { p_unit_id?: string | null; p_from?: string; p_to?: string }; Returns: { sector_name: string; count: number }[] }
      report_checklists_summary:     { Args: { p_unit_id?: string | null; p_from?: string; p_to?: string }; Returns: { total: number; on_time_count: number; overdue_count: number; top_overdue_cat: string | null }[] }
      report_checklists_by_month:    { Args: { p_unit_id?: string | null; p_from?: string; p_to?: string }; Returns: { month: string; completed_count: number; overdue_count: number }[] }
      report_checklists_by_category: { Args: { p_unit_id?: string | null; p_from?: string; p_to?: string }; Returns: { category_name: string; total_count: number; overdue_count: number }[] }
      report_staff_by_events:        { Args: { p_unit_id?: string | null; p_from?: string; p_to?: string }; Returns: { user_id: string; user_name: string; events_count: number }[] }
      report_staff_by_checklists:    { Args: { p_unit_id?: string | null; p_from?: string; p_to?: string }; Returns: { user_id: string; user_name: string; checklists_completed: number; checklists_overdue: number; maintenance_count: number }[] }
      report_staff_summary:          { Args: { p_unit_id?: string | null; p_from?: string; p_to?: string }; Returns: { top_events_user: string | null; top_checklists_user: string | null; avg_events_per_user: number | null }[] }
      // ── Helpers de RLS (Fase 2.5) ───────────────────────────────────
      get_user_unit_ids:             { Args: Record<string, never>; Returns: string[] }
      is_global_viewer:              { Args: Record<string, never>; Returns: boolean }
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
// MULTI-UNIDADE (Fase 2.5)
// ─────────────────────────────────────────────────────────────
export type Unit = {
  id: string
  name: string
  slug: string
  address: string | null
  phone: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type UserUnit = {
  id: string
  user_id: string
  unit_id: string
  role: UserRole
  is_default: boolean
  created_at: string
}

// UserUnit com dados da unidade expandida (para dropdowns e listas)
export type UserUnitWithUnit = UserUnit & {
  unit: Pick<Unit, 'id' | 'name' | 'slug' | 'is_active'>
}

// ─────────────────────────────────────────────────────────────
// CONFIGURAÇÕES AVANÇADAS (Fase 3)
// ─────────────────────────────────────────────────────────────

export type BusinessHourDay = {
  open: string    // "HH:MM"
  close: string   // "HH:MM"
  enabled: boolean
}

export type UnitSettingsData = {
  timezone?: string                              // ex: "America/Sao_Paulo"
  date_format?: string                           // ex: "DD/MM/YYYY"
  business_hours?: Record<string, BusinessHourDay> // key: "0"–"6" (Sun–Sat)
  event_defaults?: {
    default_duration_hours?: number              // ex: 4
    min_gap_hours?: number                       // ex: 1
    default_start_time?: string                  // ex: "14:00"
  }
}

export type UnitSettings = {
  id: string
  unit_id: string
  settings: UnitSettingsData
  updated_at: string
}

export type EquipmentCategory = {
  id: string
  unit_id: string
  name: string
  is_active: boolean
  sort_order: number
  created_at: string
}

// ─────────────────────────────────────────────────────────────
// TABELAS DE CONFIGURAÇÃO (por unidade — Fase 2.5)
// ─────────────────────────────────────────────────────────────
export type EventType = {
  id: string
  name: string
  unit_id: string
  is_active: boolean
  sort_order: number
  created_at: string
}

export type Package = {
  id: string
  name: string
  description: string | null
  unit_id: string
  is_active: boolean
  sort_order: number
  created_at: string
}

export type Venue = {
  id: string
  name: string
  capacity: number | null
  unit_id: string
  is_active: boolean
  sort_order: number
  created_at: string
}

export type ChecklistCategory = {
  id: string
  name: string
  unit_id: string
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
  unit_id: string
  is_active: boolean
  sort_order: number
  created_at: string
}

// ─────────────────────────────────────────────────────────────
// EQUIPMENT (Fase 3 Bloco 2)
// ─────────────────────────────────────────────────────────────

export type EquipmentStatus = 'active' | 'inactive' | 'in_repair' | 'retired'

export type Equipment = {
  id:             string
  unit_id:        string
  name:           string
  category:       string | null
  location:       string | null
  serial_number:  string | null
  purchase_date:  string | null   // ISO date
  warranty_until: string | null   // ISO date
  status:         EquipmentStatus
  notes:          string | null
  photo_url:      string | null
  created_at:     string
  updated_at:     string
}

export type EquipmentWithHistory = Equipment & {
  maintenance_orders: Pick<
    MaintenanceOrder,
    'id' | 'title' | 'type' | 'priority' | 'status' | 'created_at' | 'due_date'
  >[]
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
  unit_id: string | null   // null = permissão global; string = permissão por unidade
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
  unit_id: string
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
  unit_id?: string   // injetado pelo hook a partir do activeUnitId
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
  unit_id: string
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
  unit_id: string
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
  unit_id: string
  title: string
  description: string | null
  type: MaintenanceType
  priority: MaintenancePriority
  sector_id: string | null
  equipment_id: string | null   // FK → equipment (Fase 3 Bloco 2)
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
  unit_id: string | null   // nullable — logs globais não têm unidade
  action: string
  module: string
  entity_id: string | null
  entity_type: string
  old_data: Json | null
  new_data: Json | null
  ip: string | null
  created_at: string
}

export type AuditLogWithUser = AuditLog & {
  user: { name: string; avatar_url: string | null } | null
}

export type AuditLogFilters = {
  dateFrom?: string
  dateTo?: string
  userId?: string
  module?: string
  action?: string
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
  equipment: Pick<Equipment, 'id' | 'name' | 'category' | 'location'> | null
}

// Manutenção para listagem (sem fotos inline)
export type MaintenanceForList = MaintenanceOrder & {
  sector: Pick<Sector, 'id' | 'name'> | null
  assigned_user: Pick<User, 'id' | 'name' | 'avatar_url'> | null
  photo_count: number  // calculado no client
  equipment: Pick<Equipment, 'id' | 'name'> | null
}


// ─────────────────────────────────────────────────────────────
// TIPOS DE RELATÓRIO (Fase 3)
// ─────────────────────────────────────────────────────────────

export type ReportFilters = {
  from: string   // ISO date 'YYYY-MM-DD'
  to:   string   // ISO date 'YYYY-MM-DD'
  unitId?: string | null
}

export type EventReportSummary = {
  total_events:   number
  avg_guests:     number
  top_event_type: string | null
  top_venue:      string | null
}

export type EventsByMonth = {
  month:  string
  status: string
  count:  number
}

export type EventsByType = {
  type_name: string
  count:     number
}

export type EventsByVenue = {
  venue_name: string
  count:      number
}

export type MaintenanceReportSummary = {
  total_open:           number
  total_completed:      number
  avg_resolution_days:  number | null
  top_sector:           string | null
}

export type MaintenanceByMonth = {
  month:           string
  open_count:      number
  completed_count: number
}

export type MaintenanceBySector = {
  sector_name: string
  count:       number
}

export type ChecklistReportSummary = {
  total:           number
  on_time_count:   number
  overdue_count:   number
  top_overdue_cat: string | null
}

export type ChecklistsByMonth = {
  month:           string
  completed_count: number
  overdue_count:   number
}

export type ChecklistsByCategory = {
  category_name: string
  total_count:   number
  overdue_count: number
}

export type StaffReportSummary = {
  top_events_user:     string | null
  top_checklists_user: string | null
  avg_events_per_user: number | null
}

export type StaffByEvents = {
  user_id:      string
  user_name:    string
  events_count: number
}

export type StaffByChecklists = {
  user_id:              string
  user_name:            string
  checklists_completed: number
  checklists_overdue:   number
  maintenance_count:    number
}
