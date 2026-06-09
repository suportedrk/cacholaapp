// ============================================================
// Atas de Reunião — combinação e exibição de data + hora
// ============================================================
//
// A coluna `meeting_date` é TIMESTAMPTZ: armazena um INSTANTE, não um dia.
// O formulário captura dia (YYYY-MM-DD) + hora (HH:mm) interpretados como
// horário de São Paulo; aqui convertemos para o instante ISO (UTC) na
// gravação e de volta para dia/hora de São Paulo na leitura e exibição.
//
// ESTRATÉGIA DE FUSO — offset fixo -03:00:
// O projeto NÃO tem `date-fns-tz` como dependência e a decisão foi não
// instalar nada novo. O Brasil não adota horário de verão desde 2019,
// portanto São Paulo é UTC-03:00 o ano inteiro. Construímos o instante com
// esse offset fixo na gravação e fazemos a leitura de dia/hora pela mesma
// aritmética simétrica (subtrai 3h, lê em UTC) — imune ao footgun de
// `hourCycle` h24 do Intl, que renderiza a meia-noite como "24:00" do dia
// anterior. Os nomes por extenso (dia da semana, mês) usam Intl com
// `timeZone: 'America/Sao_Paulo'`, que concorda com o offset fixo para
// qualquer data posterior a 2019.

export const SAO_PAULO_TZ = 'America/Sao_Paulo'

/** Offset fixo de São Paulo (UTC-03:00, sem horário de verão desde 2019). */
const SAO_PAULO_OFFSET_MS = 3 * 60 * 60 * 1000
const SAO_PAULO_OFFSET_ISO = '-03:00'

/** Hora padrão usada quando nenhuma é informada (criar / duplicar). */
export const DEFAULT_MEETING_TIME = '09:00'

const HHMM_RE = /^\d{2}:\d{2}$/

/**
 * Combina uma data (YYYY-MM-DD) e um horário (HH:mm), interpretados como
 * horário de São Paulo, e devolve o instante ISO (UTC) correspondente.
 * Helper central reutilizado por create, update e duplicate das atas.
 */
export function combineSaoPauloDateTimeToISO(date: string, time: string): string {
  const safeTime = HHMM_RE.test(time) ? time : DEFAULT_MEETING_TIME
  // Ex.: "2026-06-08T21:00:00-03:00" → instante UTC "2026-06-09T00:00:00Z"
  return new Date(`${date}T${safeTime}:00${SAO_PAULO_OFFSET_ISO}`).toISOString()
}

/**
 * Quebra um instante ISO armazenado nas partes de data/hora de São Paulo.
 * Simétrico com a gravação: subtrai o offset fixo -03:00 e lê as partes em
 * UTC, onde `getUTCHours` é sempre 0–23 (sem risco de rolar o dia na
 * meia-noite, ao contrário do Intl com hourCycle h24).
 */
function saoPauloParts(iso: string) {
  const shifted = new Date(new Date(iso).getTime() - SAO_PAULO_OFFSET_MS)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    year:   String(shifted.getUTCFullYear()),
    month:  pad(shifted.getUTCMonth() + 1),
    day:    pad(shifted.getUTCDate()),
    hour:   pad(shifted.getUTCHours()),
    minute: pad(shifted.getUTCMinutes()),
  }
}

/**
 * Extrai a parte de data (YYYY-MM-DD) de um instante armazenado, em São Paulo.
 * NUNCA usar `slice(0, 10)` cru — isso pega a parte UTC e erra o dia quando o
 * instante cruza a meia-noite.
 */
export function extractSaoPauloDate(iso: string): string {
  const { year, month, day } = saoPauloParts(iso)
  return `${year}-${month}-${day}`
}

/** Extrai o horário (HH:mm) de um instante armazenado, em São Paulo. */
export function extractSaoPauloTime(iso: string): string {
  const { hour, minute } = saoPauloParts(iso)
  return `${hour}:${minute}`
}

/** Data de hoje (YYYY-MM-DD) no fuso de São Paulo — para o padrão de criar/duplicar. */
export function todaySaoPaulo(): string {
  return extractSaoPauloDate(new Date().toISOString())
}

/**
 * Data por extenso + horário em São Paulo.
 * Ex.: "segunda-feira, 8 de junho de 2026 às 21:00".
 * Os nomes (dia da semana, mês) vêm do Intl no fuso SP; o horário vem da
 * extração segura por offset fixo.
 */
export function formatSaoPauloDateTimeLong(iso: string): string {
  const datePart = new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: SAO_PAULO_TZ,
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const { hour, minute } = saoPauloParts(iso)
  return `${datePart} às ${hour}:${minute}`
}

/**
 * Data curta + horário em São Paulo. Ex.: "08/06/2026 às 21:00".
 * Usado no card da lista.
 */
export function formatSaoPauloDateTimeShort(iso: string): string {
  const datePart = new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: SAO_PAULO_TZ,
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
  const { hour, minute } = saoPauloParts(iso)
  return `${datePart} às ${hour}:${minute}`
}
