// ==========================================
// TIPOS BASE — Enums e constantes
// ==========================================

export type ProviderStatus = 'active' | 'inactive' | 'blocked' | 'pending_docs'
export type DocumentType = 'cpf' | 'cnpj'
export type ContactType = 'phone' | 'email' | 'whatsapp'
export type PriceType = 'per_event' | 'per_hour' | 'custom'
export type DocType = 'contract' | 'license' | 'certificate' | 'insurance' | 'id_document' | 'other'
export type EventProviderStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'

export const PROVIDER_STATUS_LABELS: Record<ProviderStatus, string> = {
  active:       'Ativo',
  inactive:     'Inativo',
  blocked:      'Bloqueado',
  pending_docs: 'Pendente de Docs',
}

export const PROVIDER_STATUS_COLORS: Record<ProviderStatus, string> = {
  active:       'green',
  inactive:     'gray',
  blocked:      'red',
  pending_docs: 'amber',
}

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  phone:    'Telefone',
  email:    'E-mail',
  whatsapp: 'WhatsApp',
}

export const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  per_event: 'Por evento',
  per_hour:  'Por hora',
  custom:    'Personalizado',
}

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  contract:    'Contrato',
  license:     'Alvará',
  certificate: 'Certificado',
  insurance:   'Seguro',
  id_document: 'Documento de Identidade',
  other:       'Outro',
}

export const EVENT_PROVIDER_STATUS_LABELS: Record<EventProviderStatus, string> = {
  pending:   'Pendente',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  completed: 'Concluído',
}

export const EVENT_PROVIDER_STATUS_COLORS: Record<EventProviderStatus, string> = {
  pending:   'amber',
  confirmed: 'green',
  cancelled: 'red',
  completed: 'blue',
}

// ==========================================
// INTERFACES — Tabelas do banco
// ==========================================

export interface ServiceCategory {
  id: string
  unit_id: string
  name: string
  slug: string
  description: string | null
  icon: string
  color: string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ServiceProvider {
  id: string
  unit_id: string
  document_type: DocumentType
  document_number: string
  name: string
  legal_name: string | null
  status: ProviderStatus
  tags: string[]
  notes: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  website: string | null
  instagram: string | null
  avg_rating: number
  total_events: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ProviderContact {
  id: string
  provider_id: string
  unit_id: string
  type: ContactType
  value: string
  label: string | null
  is_primary: boolean
  created_at: string
  updated_at: string
}

export interface ProviderService {
  id: string
  provider_id: string
  category_id: string
  unit_id: string
  description: string | null
  price_type: PriceType
  price_value: number | null
  currency: string
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // Join
  category?: ServiceCategory
}

export interface ProviderDocument {
  id: string
  provider_id: string
  unit_id: string
  name: string
  doc_type: DocType
  file_url: string
  file_name: string
  file_size: number | null
  mime_type: string | null
  expires_at: string | null
  expiry_alert_sent: boolean
  uploaded_by: string | null
  created_at: string
  updated_at: string
}

export interface EventProvider {
  id: string
  event_id: string
  provider_id: string
  category_id: string | null
  unit_id: string
  agreed_price: number | null
  price_type: PriceType
  status: EventProviderStatus
  arrival_time: string | null
  notes: string | null
  confirmed_by: string | null
  confirmed_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Joins
  provider?: ServiceProvider
  category?: ServiceCategory
  event?: { id: string; title?: string; date?: string; start_time?: string; end_time?: string }
}

export interface ProviderRating {
  id: string
  event_provider_id: string
  provider_id: string
  event_id: string
  unit_id: string
  rating: number
  comment: string | null
  punctuality: number | null
  quality: number | null
  professionalism: number | null
  rated_by: string
  created_at: string
  updated_at: string
  // Joins
  event?: { id: string; title?: string; date?: string }
  rated_by_user?: { id: string; name?: string }
}

// ==========================================
// INTERFACES — Expandidas (com joins)
// ==========================================

export interface ServiceProviderWithDetails extends ServiceProvider {
  contacts: ProviderContact[]
  services: ProviderService[]
  documents: ProviderDocument[]
  ratings: ProviderRating[]
  event_providers: EventProvider[]
}

export interface ServiceProviderListItem extends ServiceProvider {
  contacts: ProviderContact[]
  services: (ProviderService & { category: ServiceCategory })[]
  documents_count: number
  upcoming_events_count: number
}

// ==========================================
// INTERFACES — Filtros e forms
// ==========================================

export interface ProviderFilters {
  search: string
  status: ProviderStatus | 'all'
  category_id: string | 'all'
  min_rating: number  // 0 = sem filtro
  has_expiring_docs: boolean
}

export const DEFAULT_PROVIDER_FILTERS: ProviderFilters = {
  search:           '',
  status:           'all',
  category_id:      'all',
  min_rating:       0,
  has_expiring_docs: false,
}

export interface CreateProviderInput {
  document_type: DocumentType
  document_number: string
  name: string
  legal_name?: string
  status?: ProviderStatus
  tags?: string[]
  notes?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  website?: string
  instagram?: string
}

export interface UpdateProviderInput extends Partial<CreateProviderInput> {
  id: string
}

export interface CreateContactInput {
  provider_id: string
  unit_id: string
  type: ContactType
  value: string
  label?: string
  is_primary?: boolean
}

export interface UpdateContactInput {
  id: string
  provider_id: string
  unit_id: string
  type?: ContactType
  value?: string
  label?: string
  is_primary?: boolean
}

export interface CreateServiceInput {
  provider_id: string
  category_id: string
  unit_id: string
  description?: string
  price_type?: PriceType
  price_value?: number
  notes?: string
}

export interface UpdateServiceInput {
  id: string
  provider_id: string
  description?: string
  price_type?: PriceType
  price_value?: number
  notes?: string
  is_active?: boolean
}

export interface UploadDocumentInput {
  provider_id: string
  unit_id: string
  file: File
  name: string
  doc_type: DocType
  expires_at?: string
  onProgress?: (pct: number) => void
}

export interface CreateEventProviderInput {
  event_id: string
  provider_id: string
  category_id?: string
  unit_id: string
  status?: EventProviderStatus
  agreed_price?: number
  price_type?: PriceType
  arrival_time?: string
  notes?: string
}

export interface UpdateEventProviderInput {
  id: string
  event_id: string
  provider_id: string
  agreed_price?: number
  price_type?: PriceType
  status?: EventProviderStatus
  arrival_time?: string
  notes?: string
}

export interface CreateRatingInput {
  event_provider_id: string
  provider_id: string
  event_id: string
  unit_id: string
  rating: number
  comment?: string
  punctuality?: number
  quality?: number
  professionalism?: number
}

export interface UpdateRatingInput {
  id: string
  provider_id: string
  rating?: number
  comment?: string
  punctuality?: number
  quality?: number
  professionalism?: number
}

// ==========================================
// INTERFACE — KPIs
// ==========================================

export interface ProviderKPIs {
  totalActive: number
  avgRating: number
  expiringDocsCount: number
  scheduledThisMonth: number
  pendingRatingsCount: number
}
