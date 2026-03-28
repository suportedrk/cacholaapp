// ============================================================
// Ploomes CRM — Types da API
// ============================================================

/** Envelope OData padrão de respostas de lista */
export type PloomesODataResponse<T> = {
  value: T[]
  '@odata.count'?: number
  '@odata.nextLink'?: string
}

/** Telefone de contato */
export type PloomesPhone = {
  PhoneNumber: string
  PhoneTypeId?: number
}

/** Contato (cliente) vinculado ao deal */
export type PloomesContact = {
  Id: number
  Name: string
  Email?: string
  Phones?: PloomesPhone[]
}

/** Propriedade customizada do Deal (OtherProperties) */
export type PloomesOtherProperty = {
  FieldKey: string
  DateTimeValue?: string    // ISO 8601, ex: "2026-04-25T00:00:00-03:00"
  StringValue?: string
  IntegerValue?: number
  DecimalValue?: number
  ObjectValueName?: string  // Nome do objeto selecionado (ex: "Buffet Cachola Pinheiros")
  ObjectValueId?: number
}

/** Anexo de um Deal */
export type PloomesAttachment = {
  Id: number
  Name: string
  Url?: string
  ContentType?: string
  Size?: number
  CreateDate?: string
}

/** Deal completo do Ploomes */
export type PloomesDeal = {
  Id: number
  Title: string
  ContactId?: number
  Contact?: PloomesContact
  OwnerId?: number
  Amount?: number
  StageId?: number
  StatusId?: number
  CreateDate?: string
  LastUpdateDate?: string
  OtherProperties?: PloomesOtherProperty[]
  Attachments?: PloomesAttachment[]
}

/** Stage de um pipeline */
export type PloomesStage = {
  Id: number
  Name: string
  PipelineId: number
  Order?: number
}

/** Resultado do parse dos OtherProperties */
export type ParsedDeal = {
  ploomesId: number
  title: string
  clientName: string
  clientEmail?: string
  clientPhone?: string
  amount?: number
  // Campos customizados mapeados
  eventDate?: string      // "YYYY-MM-DD"
  startTime?: string      // "HH:MM"
  endTime?: string        // "HH:MM"
  birthdayPerson?: string
  age?: number
  guestCount?: number
  unitName?: string       // ObjectValueName do campo Unidade
  venueName?: string      // ObjectValueName do campo Casa
  theme?: string
  ploomesUrl: string
}

/** Resultado de uma sincronização */
export type SyncResult = {
  dealsFound: number
  dealsCreated: number
  dealsUpdated: number
  dealsMarkedLost: number
  dealsErrors: number
  venuesCreated: number
  typesCreated: number
  errorMessage?: string
  durationMs: number
}

/** Erro da API Ploomes */
export type PloomesApiError = {
  status: number
  message: string
  raw?: unknown
}

// ── Definição de mapeamento de campo ─────────────────────────
// Referência de tipo para field_mappings no DEAL_FIELD_MAP (código)
// (A versão para banco está em database.types.ts → PloomesConfigRow)
export type FieldMappingDef = {
  field: string
  label: string
  valueKey: 'DateTimeValue' | 'StringValue' | 'IntegerValue' | 'DecimalValue' | 'ObjectValueName'
  parser: 'date' | 'time' | 'string' | 'number'
}
