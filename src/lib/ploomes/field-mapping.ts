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
  | 'BigStringValue'
  | 'BoolValue'
  | 'IntegerValue'
  | 'DecimalValue'
  | 'ObjectValueName'

type Parser = 'date' | 'time' | 'string' | 'bool' | 'number'

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
  // ── Essenciais (9 originais) ────────────────────────────────
  'deal_7CE92372-4576-498E-B8F6-E7A863348288': { field: 'eventDate',          label: 'Data da Festa',         valueKey: 'DateTimeValue',   parser: 'date'   },
  'deal_30E82221-76E2-4882-BB33-F7FB96AC861E': { field: 'startTime',          label: 'Horário Início',        valueKey: 'DateTimeValue',   parser: 'time'   },
  'deal_FD135180-0186-46F1-8AB7-F0E1C02171B3': { field: 'endTime',            label: 'Horário Fim',           valueKey: 'DateTimeValue',   parser: 'time'   },
  'deal_2C5D41C4-C1AC-41AE-AAB9-CD12F0B61AAD': { field: 'birthdayPerson',     label: 'Aniversariante',        valueKey: 'StringValue',     parser: 'string' },
  'deal_36E32E61-DB58-441A-9788-E63B5C01BCEE': { field: 'age',                label: 'Idade',                 valueKey: 'IntegerValue',    parser: 'number' },
  'deal_05EE1763-7254-4C41-B419-365794B1CA06': { field: 'guestCount',         label: 'Nº Pessoas',            valueKey: 'IntegerValue',    parser: 'number' },
  'deal_A583075F-D19C-4034-A479-36625C621660': { field: 'unitName',           label: 'Unidade',               valueKey: 'ObjectValueName', parser: 'string' },
  'deal_40C1C918-85ED-4B7D-870D-FDE6A4FB5D9D': { field: 'venueName',          label: 'Casa/Espaço',           valueKey: 'ObjectValueName', parser: 'string' },
  'deal_9910A472-3609-4457-86F7-114A8A35A331': { field: 'theme',              label: 'Tema',                  valueKey: 'ObjectValueName', parser: 'string' },
  'deal_6DD261DD-6F37-4366-81BF-3BDC15B62C2B': { field: 'notes',             label: 'Observações',           valueKey: 'BigStringValue',  parser: 'string' },
  // ── Logística ───────────────────────────────────────────────
  'deal_403CAAC3-1152-498E-98F7-0D4FC7FD3C61': { field: 'setupTime',          label: 'Horário Montagem',      valueKey: 'DateTimeValue',   parser: 'time'   },
  'deal_B8859524-780B-4DAE-91AD-4440CC86E863': { field: 'teardownTime',       label: 'Horário Desmontagem',   valueKey: 'DateTimeValue',   parser: 'time'   },
  'deal_0CFA6928-76EB-4378-AAE6-4151FF66D26D': { field: 'showTime',           label: 'Horário Show',          valueKey: 'DateTimeValue',   parser: 'time'   },
  'deal_FCEE58CE-0F9B-4BC6-B389-FD5440E364DA': { field: 'eventLocation',      label: 'Local do Evento',       valueKey: 'ObjectValueName', parser: 'string' },
  'deal_D788F663-1228-4D16-816C-8F6CE08BC2FA': { field: 'duration',           label: 'Duração',               valueKey: 'DateTimeValue',   parser: 'time'   },
  // ── Serviços contratados ─────────────────────────────────────
  'deal_ECAAAF3B-720D-4141-BF64-0FF6F812C203': { field: 'hasShow',            label: 'Tem Show?',             valueKey: 'BoolValue',       parser: 'bool'   },
  'deal_E8816C88-BF8B-4646-A4F4-EE45D72DE5A9': { field: 'photoVideo',         label: 'Foto/Vídeo',            valueKey: 'ObjectValueName', parser: 'string' },
  'deal_7F9617A6-581E-45A5-B876-6D2621571473': { field: 'decorationAligned',  label: 'Decoração Alinhada?',   valueKey: 'BoolValue',       parser: 'bool'   },
  'deal_ED366225-61E5-4FD3-A5EB-C478DD43D17F': { field: 'hasDecoratedSweets', label: 'Doces Decorados?',      valueKey: 'BoolValue',       parser: 'bool'   },
  'deal_F47F435B-2279-42E3-B4D3-6E4A911DA9CE': { field: 'partyFavors',        label: 'Lembrancinhas?',        valueKey: 'BoolValue',       parser: 'bool'   },
  'deal_61FFFFDE-85E8-420A-ADE5-E485573C9019': { field: 'outsideDrinks',      label: 'Bebidas de Fora?',      valueKey: 'BoolValue',       parser: 'bool'   },
  // ── Família/cliente ──────────────────────────────────────────
  'deal_A7CEAF31-7D1A-49BD-A344-434F6B9E3772': { field: 'fatherName',         label: 'Nome do Pai',           valueKey: 'StringValue',     parser: 'string' },
  'deal_1B64C8B3-5DF9-4A0A-85F0-64FB01DC4E89': { field: 'school',             label: 'Escola',                valueKey: 'ObjectValueName', parser: 'string' },
  'deal_13506031-C53E-48A0-A92B-686F76AC77ED': { field: 'birthdayDate',       label: 'Data de Nascimento',    valueKey: 'DateTimeValue',   parser: 'date'   },
  // ── Financeiro/operacional ───────────────────────────────────
  'deal_95B3580C-38A0-46C3-9AFF-0414BEB44C54': { field: 'paymentMethod',      label: 'Forma de Pagamento',    valueKey: 'ObjectValueName', parser: 'string' },
  'deal_8C24AD23-78F1-410F-9DF2-DC7DBEC6D1B5': { field: 'briefing',           label: 'Briefing Inicial',      valueKey: 'BigStringValue',  parser: 'string' },
  'deal_23942EF7-5E4F-48AD-9045-117496091719': { field: 'eventCategory',      label: 'Tipo (Social/Corp.)',   valueKey: 'ObjectValueName', parser: 'string' },
  'deal_1E00056C-BFCF-4493-B48E-DF29E6F20D03': { field: 'cakeFlavor',         label: 'Sabor do Bolo',         valueKey: 'ObjectValueName', parser: 'string' },
  'deal_602CAF51-9061-4B72-87CA-F72E2878F288': { field: 'music',              label: 'Músicas',               valueKey: 'ObjectValueName', parser: 'string' },
  'deal_98B5BE4A-BDE5-48A0-8DBB-4C7BC3FF5325': { field: 'adultCount',         label: 'Nº Adultos',            valueKey: 'IntegerValue',    parser: 'number' },
  'deal_C5BACF76-AA6B-4F99-AE04-F20D5413A5CD': { field: 'kidsUnder4',         label: 'Crianças ≤4 anos',      valueKey: 'IntegerValue',    parser: 'number' },
  'deal_80C05E5C-E258-435A-993F-2FAAD139DF1F': { field: 'kidsOver5',          label: 'Crianças ≥5 anos',      valueKey: 'IntegerValue',    parser: 'number' },
}

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

function parseRawValue(prop: PloomesOtherProperty, def: FieldDef): string | number | boolean | undefined {
  const raw = prop[def.valueKey]
  if (raw === undefined || raw === null) return undefined

  switch (def.parser) {
    case 'date':   return typeof raw === 'string' ? parseDate(raw) : undefined
    case 'time':   return typeof raw === 'string' ? parseTime(raw) : undefined
    case 'number': return typeof raw === 'number' ? raw : (typeof raw === 'string' ? parseInt(raw, 10) || undefined : undefined)
    case 'bool':   return typeof raw === 'boolean' ? raw : undefined
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
      ;(result as Record<string, unknown>)[def.field] = value
    }
  }

  return result as ParsedDeal
}
