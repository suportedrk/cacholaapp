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
export const DEAL_FIELD_MAP: Record<string, FieldDef> = {
  deal_7CE92372: { field: 'eventDate',      label: 'Data da Festa',     valueKey: 'DateTimeValue',   parser: 'date'   },
  deal_30E82221: { field: 'startTime',      label: 'Horário Início',    valueKey: 'DateTimeValue',   parser: 'time'   },
  deal_FD135180: { field: 'endTime',        label: 'Horário Fim',       valueKey: 'DateTimeValue',   parser: 'time'   },
  deal_2C5D41C4: { field: 'birthdayPerson', label: 'Aniversariante',    valueKey: 'StringValue',     parser: 'string' },
  deal_36E32E61: { field: 'age',            label: 'Idade',             valueKey: 'IntegerValue',    parser: 'number' },
  deal_05EE1763: { field: 'guestCount',     label: 'Nº Pessoas',        valueKey: 'IntegerValue',    parser: 'number' },
  deal_A583075F: { field: 'unitName',       label: 'Unidade',           valueKey: 'ObjectValueName', parser: 'string' },
  deal_40C1C918: { field: 'venueName',      label: 'Casa/Espaço',       valueKey: 'ObjectValueName', parser: 'string' },
  deal_9910A472: { field: 'theme',          label: 'Tema',              valueKey: 'StringValue',     parser: 'string' },
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

  for (const prop of deal.OtherProperties ?? []) {
    const def = DEAL_FIELD_MAP[prop.FieldKey]
    if (!def) continue
    const value = parseRawValue(prop, def)
    if (value !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(result as any)[def.field] = value
    }
  }

  return result as ParsedDeal
}
