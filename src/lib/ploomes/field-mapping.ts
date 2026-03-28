// ============================================================
// Ploomes CRM — Mapeamento de Campos Customizados
// ============================================================
// DEAL_FIELD_MAP: FieldKey → campo amigável + parser.
// parseDeal(): converte OtherProperties[] em ParsedDeal tipado.

import type { PloomesDeal, PloomesOtherProperty, ParsedDeal } from './types'

const PLOOMES_APP_URL = 'https://app.ploomes.com'

// ── Tipo interno do mapa ──────────────────────────────────────
type ValueKey =
  | 'DateTimeValue'
  | 'StringValue'
  | 'IntegerValue'
  | 'DecimalValue'
  | 'ObjectValueName'

type Parser = 'date' | 'time' | 'string' | 'number'

type FieldDef = {
  field: keyof Omit<ParsedDeal, 'ploomesId' | 'title' | 'clientName' | 'clientEmail' | 'clientPhone' | 'amount' | 'ploomesUrl'>
  label: string
  valueKey: ValueKey
  parser: Parser
}

// ── Mapa central ─────────────────────────────────────────────
// FieldKey: GUID completo conforme retornado pela API Ploomes.
// A API retorna o GUID completo (ex: deal_7CE92372-4576-498E-B8F6-E7A863348288).
// O lookup em parseDeal() usa startsWith() como fallback para chaves parciais.
export const DEAL_FIELD_MAP: Record<string, FieldDef> = {
  'deal_7CE92372-4576-498E-B8F6-E7A863348288': { field: 'eventDate',      label: 'Data da Festa',   valueKey: 'DateTimeValue',   parser: 'date'   },
  'deal_30E82221-76E2-4882-BB33-F7FB96AC861E': { field: 'startTime',      label: 'Horário Início',  valueKey: 'DateTimeValue',   parser: 'time'   },
  'deal_FD135180-0186-46F1-8AB7-F0E1C02171B3': { field: 'endTime',        label: 'Horário Fim',     valueKey: 'DateTimeValue',   parser: 'time'   },
  'deal_2C5D41C4-C1AC-41AE-AAB9-CD12F0B61AAD': { field: 'birthdayPerson', label: 'Aniversariante',  valueKey: 'StringValue',     parser: 'string' },
  'deal_36E32E61-DB58-441A-9788-E63B5C01BCEE': { field: 'age',            label: 'Idade',           valueKey: 'IntegerValue',    parser: 'number' },
  'deal_05EE1763-7254-4C41-B419-365794B1CA06': { field: 'guestCount',     label: 'Nº Pessoas',      valueKey: 'IntegerValue',    parser: 'number' },
  'deal_A583075F-D19C-4034-A479-36625C621660': { field: 'unitName',       label: 'Unidade',         valueKey: 'ObjectValueName', parser: 'string' },
  'deal_40C1C918-85ED-4B7D-870D-FDE6A4FB5D9D': { field: 'venueName',      label: 'Casa/Espaço',     valueKey: 'ObjectValueName', parser: 'string' },
  'deal_9910A472-3609-4457-86F7-114A8A35A331': { field: 'theme',          label: 'Tema',            valueKey: 'ObjectValueName', parser: 'string' },
} as const

/** Rótulos legíveis por field name — útil para exibição no frontend */
export const FIELD_LABELS: Record<string, string> = Object.fromEntries(
  Object.values(DEAL_FIELD_MAP).map((def) => [def.field, def.label]),
)

// ── Parsers ──────────────────────────────────────────────────

/** "2026-04-25T00:00:00-03:00" → "2026-04-25" */
function parseDate(value: string): string {
  return value.substring(0, 10)
}

/**
 * "1970-01-01T14:00:00-03:00" → "14:00"
 * Horários do Ploomes usam data base 1970-01-01; extraímos apenas HH:MM.
 */
function parseTime(value: string): string {
  const match = /T(\d{2}:\d{2})/.exec(value)
  return match?.[1] ?? ''
}

function parseRawValue(prop: PloomesOtherProperty, def: FieldDef): string | number | undefined {
  const raw = prop[def.valueKey]
  if (raw === undefined || raw === null) return undefined

  switch (def.parser) {
    case 'date':   return typeof raw === 'string' ? parseDate(raw) : undefined
    case 'time':   return typeof raw === 'string' ? parseTime(raw) : undefined
    case 'number': return typeof raw === 'number' ? raw : (typeof raw === 'string' ? parseInt(raw, 10) || undefined : undefined)
    case 'string': return typeof raw === 'string' ? raw.trim() || undefined : String(raw)
    default:       return undefined
  }
}

// ── Parser principal ──────────────────────────────────────────

/** Converte um PloomesDeal completo em ParsedDeal normalizado */
export function parseDeal(deal: PloomesDeal): ParsedDeal {
  const result: Partial<ParsedDeal> = {
    ploomesId: deal.Id,
    title: deal.Title ?? `Festa #${deal.Id}`,
    clientName: deal.Contact?.Name ?? 'Cliente Desconhecido',
    clientEmail: deal.Contact?.Email,
    clientPhone: deal.Contact?.Phones?.[0]?.PhoneNumber,
    amount: deal.Amount,
    ploomesUrl: `${PLOOMES_APP_URL}/negocios/${deal.Id}`,
  }

  // Pré-calcular lookup por prefixo para suportar GUIDs parciais ou completos
  const mapKeys = Object.keys(DEAL_FIELD_MAP)

  for (const prop of deal.OtherProperties ?? []) {
    // Tenta match exato primeiro, depois por prefixo (FieldKey pode ser GUID completo)
    const matchedKey = DEAL_FIELD_MAP[prop.FieldKey]
      ? prop.FieldKey
      : mapKeys.find((k) => prop.FieldKey.startsWith(k) || k.startsWith(prop.FieldKey))
    const def = matchedKey ? DEAL_FIELD_MAP[matchedKey] : undefined
    if (!def) continue
    const value = parseRawValue(prop, def)
    if (value !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(result as any)[def.field] = value
    }
  }

  return result as ParsedDeal
}
