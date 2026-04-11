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
      checklist_categories: { Row: ChecklistCategory;   Insert: Partial<ChecklistCategory>; Update: Partial<ChecklistCategory>; Relationships: [] }
      // Eventos
      events:               { Row: Event;               Insert: EventInsert;             Update: EventUpdate;             Relationships: [] }
      event_staff:          { Row: EventStaff;          Insert: Partial<EventStaff>;     Update: Partial<EventStaff>;     Relationships: [] }
      // Checklists
      checklist_templates:      { Row: ChecklistTemplate;      Insert: Partial<ChecklistTemplate>;      Update: Partial<ChecklistTemplate>;      Relationships: [] }
      template_items:           { Row: TemplateItem;           Insert: Partial<TemplateItem>;           Update: Partial<TemplateItem>;           Relationships: [] }
      checklists:               { Row: Checklist;              Insert: Partial<Checklist>;              Update: Partial<Checklist>;              Relationships: [] }
      checklist_items:          { Row: ChecklistItem;          Insert: Partial<ChecklistItem>;          Update: Partial<ChecklistItem>;          Relationships: [] }
      // Checklists Premium (Migration 018)
      checklist_recurrence:     { Row: ChecklistRecurrence;    Insert: Partial<ChecklistRecurrence>;    Update: Partial<ChecklistRecurrence>;    Relationships: [] }
      checklist_item_comments:  { Row: ChecklistItemComment;   Insert: Partial<ChecklistItemComment>;   Update: Partial<ChecklistItemComment>;   Relationships: [] }
      // Manutenção — Schema 031/032 (tabelas novas)
      maintenance_sectors:    { Row: Sector;                Insert: Partial<Sector>;                Update: Partial<Sector>;                Relationships: [] }
      maintenance_categories: { Row: MaintenanceCategory;   Insert: Partial<MaintenanceCategory>;   Update: Partial<MaintenanceCategory>;   Relationships: [] }
      maintenance_items:      { Row: MaintenanceItem;       Insert: Partial<MaintenanceItem>;       Update: Partial<MaintenanceItem>;       Relationships: [] }
      maintenance_sla:        { Row: MaintenanceSla;        Insert: Partial<MaintenanceSla>;        Update: Partial<MaintenanceSla>;        Relationships: [] }
      maintenance_tickets:          { Row: MaintenanceTicket;          Insert: Partial<MaintenanceTicket>;          Update: Partial<MaintenanceTicket>;          Relationships: [] }
      maintenance_executions:       { Row: MaintenanceExecution;       Insert: Partial<MaintenanceExecution>;       Update: Partial<MaintenanceExecution>;       Relationships: [] }
      maintenance_ticket_photos:    { Row: MaintenanceTicketPhoto;     Insert: Partial<MaintenanceTicketPhoto>;     Update: Partial<MaintenanceTicketPhoto>;     Relationships: [] }
      maintenance_status_history:   { Row: MaintenanceStatusHistory;   Insert: Partial<MaintenanceStatusHistory>;   Update: Partial<MaintenanceStatusHistory>;   Relationships: [] }
      equipment:            { Row: Equipment;           Insert: Partial<Equipment>;        Update: Partial<Equipment>;        Relationships: [] }
      // Manutenção — ghost types (tabelas dropadas em 032, UI refatorada nos Prompts 4-7)
      maintenance_orders:   { Row: MaintenanceOrder;    Insert: Partial<MaintenanceOrder>; Update: Partial<MaintenanceOrder>; Relationships: [] }
      maintenance_photos:   { Row: MaintenancePhoto;    Insert: Partial<MaintenancePhoto>; Update: Partial<MaintenancePhoto>; Relationships: [] }
      maintenance_suppliers: { Row: MaintenanceSupplier; Insert: Partial<MaintenanceSupplier>; Update: Partial<MaintenanceSupplier>; Relationships: [] }
      supplier_contacts:     { Row: SupplierContact;     Insert: Partial<SupplierContact>;     Update: Partial<SupplierContact>;     Relationships: [] }
      supplier_documents:    { Row: SupplierDocument;    Insert: Partial<SupplierDocument>;    Update: Partial<SupplierDocument>;    Relationships: [] }
      maintenance_costs:     { Row: MaintenanceCost;     Insert: Partial<MaintenanceCost>;     Update: Partial<MaintenanceCost>;     Relationships: [] }
      // Configurações avançadas (Fase 3)
      unit_settings:        { Row: UnitSettings;        Insert: Partial<UnitSettings>;   Update: Partial<UnitSettings>;   Relationships: [] }
      equipment_categories: { Row: EquipmentCategory;   Insert: Partial<EquipmentCategory>; Update: Partial<EquipmentCategory>; Relationships: [] }
      // Integração Ploomes CRM
      ploomes_config:        { Row: PloomesConfigRow;      Insert: Partial<PloomesConfigRow>;      Update: Partial<PloomesConfigRow>;      Relationships: [] }
      ploomes_sync_log:      { Row: PloomesSyncLog;        Insert: Partial<PloomesSyncLog>;        Update: Partial<PloomesSyncLog>;        Relationships: [] }
      ploomes_unit_mapping:  { Row: PloomesUnitMapping;    Insert: Partial<PloomesUnitMapping>;    Update: Partial<PloomesUnitMapping>;    Relationships: [] }
      ploomes_webhook_log:   { Row: PloomesWebhookLog;     Insert: Partial<PloomesWebhookLog>;     Update: Partial<PloomesWebhookLog>;     Relationships: [] }
      // Prestadores de Serviços (Migration 021)
      service_categories:   { Row: ServiceCategory;     Insert: Partial<ServiceCategory>;    Update: Partial<ServiceCategory>;    Relationships: [] }
      service_providers:    { Row: ServiceProvider;     Insert: Partial<ServiceProvider>;    Update: Partial<ServiceProvider>;    Relationships: [] }
      provider_contacts:    { Row: ProviderContact;     Insert: Partial<ProviderContact>;    Update: Partial<ProviderContact>;    Relationships: [] }
      provider_services:    { Row: ProviderService;     Insert: Partial<ProviderService>;    Update: Partial<ProviderService>;    Relationships: [] }
      provider_documents:   { Row: ProviderDocument;    Insert: Partial<ProviderDocument>;   Update: Partial<ProviderDocument>;   Relationships: [] }
      event_providers:      { Row: EventProvider;       Insert: Partial<EventProvider>;      Update: Partial<EventProvider>;      Relationships: [] }
      provider_ratings:     { Row: ProviderRating;      Insert: Partial<ProviderRating>;     Update: Partial<ProviderRating>;     Relationships: [] }
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
      // ── Conflito de horário entre eventos (Migration 027) ────────────
      get_event_conflicts:           { Args: { p_unit_id: string }; Returns: { event_id_a: string; event_id_b: string; conflict_date: string; gap_minutes: number }[] }
      get_conflicting_event_ids:     { Args: { p_unit_id: string }; Returns: { event_id: string }[] }
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
// Fase 4 (migration 016): adicionado 'lost' para deals Perdido do Ploomes
export type EventStatus =
  | 'pending'     // Pendente (aguardando confirmação)
  | 'confirmed'   // Confirmado
  | 'preparing'   // Em Preparo (decoração, cozinha etc.)
  | 'in_progress' // Em Andamento (evento acontecendo)
  | 'finished'    // Finalizado
  | 'post_event'  // Pós-Evento (limpeza, devolução, avaliação)
  | 'lost'        // Perdido (via Ploomes StatusId=3 — oculto por padrão na UI)

export type ChecklistStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
export type ChecklistItemStatus = 'pending' | 'done' | 'na'
export type ChecklistType = 'event' | 'standalone' | 'recurring'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'

// Labels pt-BR e utilitários de UI (usados em filtros, badges, forms)
export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
}

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'text-green-600',
  medium: 'text-yellow-600',
  high: 'text-orange-600',
  urgent: 'text-red-600',
}

export const CHECKLIST_TYPE_LABELS: Record<ChecklistType, string> = {
  event: 'Evento',
  standalone: 'Avulso',
  recurring: 'Recorrente',
}

export const CHECKLIST_STATUS_LABELS: Record<ChecklistStatus, string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  completed: 'Concluído',
  cancelled: 'Cancelado',
}
export type MaintenanceType = 'emergency' | 'preventive' | 'punctual' | 'recurring'
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
  brand?: {
    accent_color?: string   // hex ex: "#7C8D78"
    logo_url?: string       // storage path em user-avatars/unit-logos/{unitId}/logo.jpg
    display_name?: string   // nome curto exibido na sidebar
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
export type ChecklistCategory = {
  id: string
  name: string
  unit_id: string
  is_active: boolean
  sort_order: number
  created_at: string
}

// ─────────────────────────────────────────────────────────────
// MANUTENÇÃO — SCHEMA 031 (novo)
// ─────────────────────────────────────────────────────────────
export type MaintenanceTicket = {
  id: string
  unit_id: string
  title: string
  description?: string | null
  sector_id?: string | null
  category_id?: string | null
  item_id?: string | null
  nature: 'emergencial' | 'pontual' | 'agendado' | 'preventivo'
  urgency: 'critical' | 'high' | 'medium' | 'low'
  status: 'open' | 'in_progress' | 'waiting_part' | 'concluded' | 'cancelled'
  scheduled_date?: string | null
  concluded_at?: string | null
  due_at?: string | null
  opened_by: string
  equipment_id?: string | null
  total_cost: number
  created_at: string
  updated_at: string
}

// MANUTENÇÃO — CONFIGURAÇÃO
// ─────────────────────────────────────────────────────────────
export type Sector = {
  id: string
  name: string
  description?: string | null
  unit_id: string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type MaintenanceCategory = {
  id: string
  unit_id: string
  name: string
  color: string        // hex, ex: '#F59E0B'
  icon: string         // nome do ícone Lucide, ex: 'zap'
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type MaintenanceItem = {
  id: string
  unit_id: string
  sector_id: string | null
  name: string
  description: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type MaintenanceItemWithSector = MaintenanceItem & {
  sector: Pick<Sector, 'id' | 'name'> | null
}

export type MaintenanceSla = {
  id: string
  unit_id: string
  urgency_level: 'critical' | 'high' | 'medium' | 'low'
  response_hours: number
  resolution_hours: number
  created_at: string
  updated_at: string
}

// ─────────────────────────────────────────────────────────────
// MANUTENÇÃO — CHAMADOS (Migration 031)
// ─────────────────────────────────────────────────────────────
export type TicketNature  = 'emergencial' | 'pontual' | 'agendado' | 'preventivo'
export type TicketUrgency = 'critical' | 'high' | 'medium' | 'low'
export type TicketStatus  = 'open' | 'in_progress' | 'waiting_part' | 'concluded' | 'cancelled'
export type ExecutorType  = 'internal' | 'external'
export type ExecutionStatus = 'assigned' | 'in_progress' | 'concluded'

export type MaintenanceExecution = {
  id: string
  ticket_id: string
  executor_type: ExecutorType
  internal_user_id: string | null
  provider_id: string | null
  description: string | null
  cost: number
  cost_approved: boolean
  cost_approved_by: string | null
  cost_approved_at: string | null
  status: ExecutionStatus
  started_at: string | null
  concluded_at: string | null
  created_at: string
  updated_at: string
}

export type MaintenanceTicketPhoto = {
  id: string
  ticket_id: string
  url: string
  caption: string | null
  uploaded_by: string | null
  created_at: string
}

export type MaintenanceStatusHistory = {
  id: string
  ticket_id: string
  from_status: string | null
  to_status: string
  changed_by: string | null
  note: string | null
  created_at: string
}

// Ticket com joins para listagem
export type MaintenanceTicketForList = MaintenanceTicket & {
  sector:   Pick<Sector, 'id' | 'name'> | null
  category: Pick<MaintenanceCategory, 'id' | 'name' | 'color' | 'icon'> | null
  executions_count?: number
}

// Ticket com joins completos para detalhe
export type MaintenanceTicketWithDetails = MaintenanceTicket & {
  sector:    Pick<Sector, 'id' | 'name'> | null
  category:  Pick<MaintenanceCategory, 'id' | 'name' | 'color' | 'icon'> | null
  item:      Pick<MaintenanceItem, 'id' | 'name'> | null
  equipment: Pick<Equipment, 'id' | 'name' | 'category'> | null
  executions: (MaintenanceExecution & {
    internal_user: Pick<User, 'id' | 'name' | 'avatar_url'> | null
    provider:      { id: string; name: string } | null
  })[]
  photos:  MaintenanceTicketPhoto[]
  history: (MaintenanceStatusHistory & {
    changed_by_user: { name: string } | null
  })[]
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
    onboarding_completed?: boolean
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
// EVENTOS
// ─────────────────────────────────────────────────────────────
export type Event = {
  id: string
  unit_id: string
  ploomes_deal_id: string | null
  ploomes_url: string | null
  title: string
  date: string           // DATE → 'YYYY-MM-DD'
  start_time: string     // TIME → 'HH:MM:SS'
  end_time: string       // TIME → 'HH:MM:SS'
  status: EventStatus
  client_name: string
  client_phone: string | null  // migration 019
  client_email: string | null  // migration 019
  birthday_person: string | null
  birthday_age: number | null
  guest_count: number | null
  theme: string | null         // migration 019
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
  // Ploomes enrichment (migration 020) — apenas deals Ploomes
  setup_time: string | null          // TIME 'HH:MM:SS'
  teardown_time: string | null       // TIME 'HH:MM:SS'
  show_time: string | null           // TIME 'HH:MM:SS'
  event_location: string | null
  duration: string | null            // TIME 'HH:MM:SS'
  has_show: boolean
  photo_video: string | null
  decoration_aligned: boolean
  has_decorated_sweets: boolean
  party_favors: boolean
  outside_drinks: boolean
  father_name: string | null
  school: string | null
  birthday_date: string | null       // DATE 'YYYY-MM-DD'
  payment_method: string | null
  briefing: string | null
  event_category: string | null
  cake_flavor: string | null
  music: string | null
  adult_count: number | null
  kids_under4: number | null
  kids_over5: number | null
  deal_amount: number | null
}

export type EventInsert = {
  unit_id?: string   // injetado pelo hook a partir do activeUnitId
  title: string
  date: string
  start_time: string
  end_time: string
  status?: EventStatus
  client_name: string
  client_phone?: string | null
  client_email?: string | null
  birthday_person?: string | null
  birthday_age?: number | null
  guest_count?: number | null
  theme?: string | null
  notes?: string | null
  ploomes_deal_id?: string | null
  ploomes_url?: string | null
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
  category: string                     // TEXT legado
  category_id: string | null           // FK → checklist_categories
  created_by: string
  is_active: boolean
  // Migration 018 — Checklists Premium
  description: string | null
  estimated_duration_minutes: number | null
  default_priority: Priority
  recurrence_rule: ChecklistRecurrenceRule | null
  created_at: string
  updated_at: string
}

export type TemplateItem = {
  id: string
  template_id: string
  description: string
  sort_order: number
  // Migration 018 — Checklists Premium
  default_priority: Priority
  default_estimated_minutes: number | null
  default_assigned_to: DefaultAssignedTo | null
  notes_template: string | null
  requires_photo: boolean
  is_required: boolean
}

// shape de default_assigned_to em template_items
export type DefaultAssignedTo = {
  type: 'role' | 'user'
  value: string  // nome do role ou UUID do usuário
}

// shape de recurrence_rule em checklist_templates (JSONB — mesma shape de ChecklistRecurrence.rule)
export type ChecklistRecurrenceRule = {
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly'
  interval?: number
  days_of_week?: number[]   // 0=dom…6=sáb
  day_of_month?: number     // 1-31
  time_of_day?: string      // 'HH:MM'
  end_date?: string         // ISO date
  max_occurrences?: number
}

export type Checklist = {
  id: string
  unit_id: string
  title: string
  template_id: string | null
  event_id: string | null
  assigned_to: string | null
  status: ChecklistStatus
  due_date: string | null  // prazo geral do checklist
  created_at: string
  updated_at: string
  // Migration 018 — Checklists Premium
  type: ChecklistType
  priority: Priority
  description: string | null
  created_by: string | null
  completed_at: string | null
  completed_by: string | null
  duplicated_from: string | null
  recurrence_id: string | null
}

export type ChecklistItem = {
  id: string
  checklist_id: string
  description: string
  is_done: boolean               // legado — derivado de status
  status: ChecklistItemStatus    // 'pending' | 'done' | 'na'
  done_by: string | null
  done_at: string | null
  photo_url: string | null
  notes: string | null
  sort_order: number
  created_at: string
  // Migration 018 — Checklists Premium
  assigned_to: string | null
  priority: Priority
  due_at: string | null          // prazo individual do item (due_date do checklist é o geral)
  estimated_minutes: number | null
  actual_minutes: number | null
  is_required: boolean           // copiado de template_items.is_required na criação
}

// Migration 018 — nova tabela: regras de recorrência
export type ChecklistRecurrence = {
  id: string
  template_id: string
  unit_id: string
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly'
  day_of_week: number[] | null  // 0=dom…6=sáb
  day_of_month: number | null   // 1-31
  time_of_day: string           // 'HH:MM:SS'
  assigned_to: string | null
  is_active: boolean
  last_generated_at: string | null
  next_generation_at: string | null
  title_prefix: string | null
  description: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Joins opcionais
  template?: ChecklistTemplate
  assigned_user?: Pick<User, 'id' | 'name' | 'avatar_url'>
}

// Migration 018 — nova tabela: comentários por item
export type ChecklistItemComment = {
  id: string
  item_id: string
  user_id: string
  content: string
  photo_url: string | null
  unit_id: string
  created_at: string
  updated_at: string
  // Join opcional
  user?: Pick<User, 'id' | 'name' | 'avatar_url'>
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
  // Migration 017 — schema expansion
  supplier_id:     string | null
  cost_estimate:   number | null
  completed_at:    string | null
  preventive_plan: PreventivePlan | null
  created_by: string
  created_at: string
  updated_at: string
}

export type PreventivePlan = {
  frequency:            'monthly' | 'quarterly' | 'semiannual' | 'annual'
  interval:             number
  checklist_items:      string[]
  last_performed_at:    string | null
  next_due_date:        string | null
  advance_notice_days:  number
  linked_equipment_id:  string | null
}

export type MaintenanceSupplier = {
  id:           string
  unit_id:      string
  company_name: string
  trade_name:   string | null
  cnpj:         string | null
  category:     string | null
  email:        string | null
  phone:        string | null
  address:      string | null
  notes:        string | null
  is_active:    boolean
  rating:       number | null
  created_at:   string
  updated_at:   string
}

export type SupplierContact = {
  id:          string
  supplier_id: string
  name:        string
  role:        string | null
  phone:       string | null
  whatsapp:    string | null
  email:       string | null
  is_primary:  boolean
  created_at:  string
}

export type SupplierDocument = {
  id:               string
  supplier_id:      string
  name:             string
  file_url:         string
  file_type:        string | null
  file_size_bytes:  number | null
  uploaded_by:      string | null
  expires_at:       string | null
  created_at:       string
}

export type MaintenanceCostStatus = 'pending' | 'approved' | 'rejected'
export type MaintenanceCostType   = 'material' | 'labor' | 'travel' | 'other'

export type MaintenanceCost = {
  id:            string
  unit_id:       string
  order_id:      string
  description:   string
  amount:        number
  cost_type:     MaintenanceCostType
  receipt_url:   string | null
  receipt_notes: string | null
  status:        MaintenanceCostStatus
  submitted_by:  string
  submitted_at:  string
  reviewed_by:   string | null
  reviewed_at:   string | null
  review_notes:  string | null
  created_at:    string
  updated_at:    string
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
// PLOOMES CRM
// ─────────────────────────────────────────────────────────────
export type PloomesConfigRow = {
  id: string
  unit_id: string
  user_key: string
  pipeline_id: number
  stage_id: number
  won_status_id: number
  field_mappings: Record<string, {
    field: string
    label: string
    valueKey: string
    parser: string
  }>
  contact_mappings: Record<string, string>
  status_mappings: Record<string, string>
  webhook_url: string | null
  webhook_registered_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type PloomesSyncLog = {
  id: string
  started_at: string
  finished_at: string | null
  status: 'running' | 'success' | 'error'
  deals_found: number
  deals_created: number
  deals_updated: number
  deals_errors: number
  deals_removed: number
  venues_created: number
  types_created: number
  error_message: string | null
  triggered_by: 'cron' | 'manual' | 'webhook'
  triggered_by_user_id: string | null
  unit_id: string | null
  created_at: string
}

export type PloomesUnitMapping = {
  id: string
  ploomes_value: string
  ploomes_object_id: number | null
  unit_id: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type PloomesWebhookLog = {
  id: string
  received_at: string
  deal_id: number | null
  action: string | null
  entity: string | null
  status: 'received' | 'processing' | 'success' | 'error' | 'skipped'
  error_message: string | null
  processing_ms: number | null
  raw_payload: Record<string, unknown> | null
  sync_log_id: string | null
  created_at: string
}

// ─────────────────────────────────────────────────────────────
// TIPOS COM RELACIONAMENTOS (para queries com join/select aninhado)
// ─────────────────────────────────────────────────────────────

// Evento com dados completos para cards e detalhe
export type EventWithDetails = Event & {
  staff: Array<{
    id: string
    role_in_event: string
    user: Pick<User, 'id' | 'name' | 'avatar_url'>
  }>
}

// Evento para listagem paginada — inclui progresso de checklists
export type EventForList = Event & {
  staff: Array<{
    id: string
    role_in_event: string
    user: Pick<User, 'id' | 'name' | 'avatar_url'>
  }>
  checklists: Array<{
    id: string
    status: ChecklistStatus
    checklist_items: Array<{ id: string; status: ChecklistItemStatus }>
  }>
  providers_count?: Array<{ count: number }>
}

// Checklist com itens completos (tela de preenchimento)
export type ChecklistWithItems = Checklist & {
  checklist_items: Array<ChecklistItem & {
    assigned_user?: Pick<User, 'id' | 'name' | 'avatar_url'>
    comments?: ChecklistItemComment[]
  }>
  event: Pick<Event, 'id' | 'title' | 'date'> | null
  assigned_user: Pick<User, 'id' | 'name' | 'avatar_url'> | null
  completed_by_user?: Pick<User, 'id' | 'name' | 'avatar_url'> | null
  recurrence?: ChecklistRecurrence | null
}

// Checklist para listagem (itens apenas com id+status+priority para progresso)
export type ChecklistForList = Checklist & {
  event: Pick<Event, 'id' | 'title' | 'date'> | null
  assigned_user: Pick<User, 'id' | 'name' | 'avatar_url'> | null
  checklist_items: Array<{ id: string; status: ChecklistItemStatus; priority: Priority }>
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

// Manutenção para listagem (com fotos e fornecedor)
export type MaintenanceForList = MaintenanceOrder & {
  sector: Pick<Sector, 'id' | 'name'> | null
  assigned_user: Pick<User, 'id' | 'name' | 'avatar_url'> | null
  equipment: Pick<Equipment, 'id' | 'name'> | null
  supplier: Pick<MaintenanceSupplier, 'id' | 'company_name'> | null
  photos: Array<Pick<MaintenancePhoto, 'id' | 'url' | 'type'>>
  /** @deprecated use photos.length */
  photo_count: number
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

// ─────────────────────────────────────────────────────────────
// PRESTADORES DE SERVIÇOS — DB row types (Migration 021)
// Rich/join types live in src/types/providers.ts
// ─────────────────────────────────────────────────────────────
export type ProviderDocumentType = 'cpf' | 'cnpj'
export type ProviderContactType  = 'phone' | 'email' | 'whatsapp'
export type ProviderPriceType    = 'per_event' | 'per_hour' | 'custom'
export type ProviderDocType      = 'contract' | 'license' | 'certificate' | 'insurance' | 'id_document' | 'other'
export type ProviderStatusType   = 'active' | 'inactive' | 'blocked' | 'pending_docs'
export type EventProviderStatusType = 'pending' | 'confirmed' | 'cancelled' | 'completed'

export type ServiceCategory = {
  id:          string
  unit_id:     string
  name:        string
  slug:        string
  description: string | null
  icon:        string
  color:       string
  is_active:   boolean
  sort_order:  number
  created_at:  string
  updated_at:  string
}

export type ServiceProvider = {
  id:              string
  unit_id:         string
  document_type:   ProviderDocumentType
  document_number: string
  name:            string
  legal_name:      string | null
  status:          ProviderStatusType
  tags:            string[]
  notes:           string | null
  address:         string | null
  city:            string | null
  state:           string | null
  zip_code:        string | null
  website:         string | null
  instagram:       string | null
  avg_rating:      number
  total_events:    number
  created_by:      string | null
  created_at:      string
  updated_at:      string
}

export type ProviderContact = {
  id:          string
  provider_id: string
  unit_id:     string
  type:        ProviderContactType
  value:       string
  label:       string | null
  is_primary:  boolean
  created_at:  string
  updated_at:  string
}

export type ProviderService = {
  id:          string
  provider_id: string
  category_id: string
  unit_id:     string
  description: string | null
  price_type:  ProviderPriceType
  price_value: number | null
  currency:    string
  notes:       string | null
  is_active:   boolean
  created_at:  string
  updated_at:  string
}

export type ProviderDocument = {
  id:                 string
  provider_id:        string
  unit_id:            string
  name:               string
  doc_type:           ProviderDocType
  file_url:           string
  file_name:          string
  file_size:          number | null
  mime_type:          string | null
  expires_at:         string | null
  expiry_alert_sent:  boolean
  uploaded_by:        string | null
  created_at:         string
  updated_at:         string
}

export type EventProvider = {
  id:           string
  event_id:     string
  provider_id:  string
  category_id:  string | null
  unit_id:      string
  agreed_price: number | null
  price_type:   ProviderPriceType
  status:       EventProviderStatusType
  arrival_time: string | null
  notes:        string | null
  confirmed_by: string | null
  confirmed_at: string | null
  created_by:   string | null
  created_at:   string
  updated_at:   string
}

export type ProviderRating = {
  id:                string
  event_provider_id: string
  provider_id:       string
  event_id:          string
  unit_id:           string
  rating:            number
  comment:           string | null
  punctuality:       number | null
  quality:           number | null
  professionalism:   number | null
  rated_by:          string
  created_at:        string
  updated_at:        string
}
