import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { deriveTimeline } from '@/components/features/events/event-timeline'
import {
  buildChecklistClienteItems,
  type ChecklistClienteItem,
} from './checklist-cliente-print'
import {
  buildChecklistDecoracaoItems,
  type ChecklistDecoracaoItem,
} from './checklist-decoracao-print'
import type { EventWithDetails, ChecklistForList } from '@/types/database.types'

const NAO_PREENCHIDO = 'não preenchido'
const RESTRITO = 'Restrito'

// ── value helpers ──────────────────────────────────────────────
function textValue(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return NAO_PREENCHIDO
  const s = String(v).trim()
  return s === '' ? NAO_PREENCHIDO : s
}
function timeValue(v: string | null | undefined): string {
  if (!v) return NAO_PREENCHIDO
  return v.slice(0, 5)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── lazy data shapes (fetched on demand for the print) ─────────
interface SalesProductRow {
  group_name: string | null
  product_name: string | null
  quantity: number
}

interface FestaItemRow {
  item_nome: string
  detalhe: string | null
  quantidade: number
}

interface FestaDecoracaoPrintData {
  tema_nome: string | null
  itens: FestaItemRow[]
}

// ── field grid renderer (same look as the individual checklists) ─
type FieldItem = ChecklistClienteItem | ChecklistDecoracaoItem

function renderFields(items: FieldItem[]): string {
  return (
    '<div class="items">' +
    items
      .map((it) => {
        const empty = it.value === NAO_PREENCHIDO
        const restricted = it.restricted === true || it.value === RESTRITO
        const valueClass = restricted ? 'value restricted' : empty ? 'value empty' : 'value'
        const fieldClass = it.multiline ? 'field full' : 'field'
        return (
          '<div class="' + fieldClass + '">' +
          '<p class="label">' + escapeHtml(it.label) + '</p>' +
          '<p class="' + valueClass + '">' + escapeHtml(it.value) + '</p>' +
          '</div>'
        )
      })
      .join('') +
    '</div>'
  )
}

function section(title: string, body: string): string {
  return (
    '<section class="sec">' +
    '<h2 class="sec-title">' + escapeHtml(title) + '</h2>' +
    body +
    '</section>'
  )
}

// ── individual section builders ────────────────────────────────
function partyInfoSection(event: EventWithDetails): string {
  const breakdown = [
    event.adult_count ? `${event.adult_count} adultos` : null,
    event.kids_over5 ? `${event.kids_over5} crianças ≥5` : null,
    event.kids_under4 ? `${event.kids_under4} crianças ≤4` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const guestValue =
    event.guest_count !== null && event.guest_count !== undefined
      ? `${event.guest_count} pessoas${breakdown ? ` (${breakdown})` : ''}`
      : NAO_PREENCHIDO

  const items: FieldItem[] = [
    { label: 'Tipo', value: textValue(event.event_category) },
    { label: 'Convidados', value: guestValue },
    { label: 'Sabor do bolo', value: textValue(event.cake_flavor) },
    { label: 'Músicas', value: textValue(event.music) },
    { label: 'Observações', value: textValue(event.notes), multiline: true },
  ]
  return section('Informações da Festa', renderFields(items))
}

function logisticsSection(event: EventWithDetails): string {
  const items: FieldItem[] = [
    { label: 'Montagem', value: timeValue(event.setup_time) },
    { label: 'Início', value: timeValue(event.start_time) },
    { label: 'Show', value: timeValue(event.show_time) },
    { label: 'Término', value: timeValue(event.end_time) },
    { label: 'Desmontagem', value: timeValue(event.teardown_time) },
    { label: 'Local', value: textValue(event.event_location), multiline: true },
  ]
  return section('Logística', renderFields(items))
}

function clientSection(event: EventWithDetails): string {
  const birthday = event.birthday_person
    ? `${event.birthday_person}${event.birthday_age ? ` · ${event.birthday_age} anos` : ''}${
        event.birthday_date
          ? ` (${format(parseISO(event.birthday_date + 'T00:00:00'), 'dd/MM/yyyy')})`
          : ''
      }`
    : NAO_PREENCHIDO

  const items: FieldItem[] = [
    { label: 'Cliente', value: textValue(event.client_name) },
    { label: 'Aniversariante', value: birthday },
    { label: 'Nome do pai', value: textValue(event.father_name) },
    { label: 'Escola', value: textValue(event.school) },
    { label: 'Telefone', value: textValue(event.client_phone) },
    { label: 'E-mail', value: textValue(event.client_email) },
  ]
  return section('Cliente e Família', renderFields(items))
}

function salesSection(products: SalesProductRow[]): string {
  if (products.length === 0) {
    return section('Vendas — Produtos', '<p class="muted">Nenhum produto registrado no Ploomes.</p>')
  }
  const rows = products
    .map(
      (p) =>
        '<tr>' +
        '<td>' + escapeHtml(p.group_name ?? '—') + '</td>' +
        '<td>' + escapeHtml(p.product_name ?? '—') + '</td>' +
        '<td class="num">' + escapeHtml(String(p.quantity)) + '</td>' +
        '</tr>',
    )
    .join('')
  const table =
    '<table class="tbl">' +
    '<thead><tr><th>Categoria</th><th>Produto</th><th class="num">Qtd</th></tr></thead>' +
    '<tbody>' + rows + '</tbody>' +
    '</table>'
  return section('Vendas — Produtos', table)
}

function teamSection(event: EventWithDetails): string {
  const staff = event.staff ?? []
  if (staff.length === 0) return ''
  const rows = staff
    .map(
      (s) =>
        '<li><span class="team-name">' + escapeHtml(s.user.name) + '</span>' +
        '<span class="team-role">' + escapeHtml(s.role_in_event ?? '—') + '</span></li>',
    )
    .join('')
  return section('Equipe Designada', '<ul class="team-list">' + rows + '</ul>')
}

function festaDecoracaoSection(data: FestaDecoracaoPrintData | null): string {
  if (!data || (!data.tema_nome && data.itens.length === 0)) {
    return section('Decoração da Festa', '<p class="muted">Sem decoração vinculada a esta festa.</p>')
  }
  const temaLine =
    '<p class="kv"><span class="kv-k">Tema</span><span class="kv-v">' +
    escapeHtml(data.tema_nome ?? NAO_PREENCHIDO) +
    '</span></p>'

  if (data.itens.length === 0) {
    return section('Decoração da Festa', temaLine)
  }

  const rows = data.itens
    .map(
      (it) =>
        '<tr>' +
        '<td>' + escapeHtml(it.item_nome) + '</td>' +
        '<td>' + escapeHtml(it.detalhe ?? '—') + '</td>' +
        '<td class="num">' + escapeHtml(String(it.quantidade)) + '</td>' +
        '</tr>',
    )
    .join('')
  const table =
    '<table class="tbl">' +
    '<thead><tr><th>Item</th><th>Detalhe</th><th class="num">Qtd</th></tr></thead>' +
    '<tbody>' + rows + '</tbody>' +
    '</table>'
  return section('Decoração da Festa', temaLine + table)
}

function historySection(event: EventWithDetails, checklists: ChecklistForList[]): string {
  const items = deriveTimeline(event, checklists)
  if (items.length === 0) {
    return section('Histórico', '<p class="muted">Sem histórico registrado.</p>')
  }
  const rows = items
    .map((it) => {
      const ts = it.timestamp ? format(it.timestamp, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : ''
      return (
        '<li>' +
        '<span class="tl-ts">' + escapeHtml(ts) + '</span>' +
        '<span class="tl-body">' +
        '<span class="tl-title">' + escapeHtml(it.title) + '</span>' +
        (it.subtitle ? '<span class="tl-sub">' + escapeHtml(it.subtitle) + '</span>' : '') +
        '</span>' +
        '</li>'
      )
    })
    .join('')
  return section('Histórico', '<ul class="tl-list">' + rows + '</ul>')
}

// ── styles (print-only; inline hex is the established print pattern) ─
const STYLES = `
@page { size: A4; margin: 0 0 12mm 0;
  @bottom-left { content: "Gerado por CacholaOS — GERADO_EM"; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 9px; color: #888888; padding-left: 14mm; border-top: 1px solid #e5e5e5; }
  @bottom-right { content: counter(page) "/" counter(pages); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 9px; color: #888888; padding-right: 14mm; border-top: 1px solid #e5e5e5; }
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111; font-size: 12px; line-height: 1.35; padding: 14mm; }
.header { border-bottom: 2px solid #7C8D78; padding-bottom: 8px; margin-bottom: 14px; }
.header h1 { font-size: 18px; margin: 0 0 2px; }
.header .subtitle { font-size: 12px; color: #444444; margin: 0; }
.meta { display: flex; flex-wrap: wrap; gap: 8px 22px; margin-bottom: 6px; }
.meta > div { min-width: 120px; }
.meta .k { font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; color: #777777; margin: 0; }
.meta .v { font-size: 12px; margin: 2px 0 0; }
.meta .v.cap { text-transform: capitalize; }
.sec { margin-top: 16px; }
.sec-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #7C8D78; font-weight: 700; margin: 0 0 8px; padding-bottom: 3px; border-bottom: 1.5px solid #cdd5ca; }
.items { font-size: 0; }
.field { display: inline-block; width: 50%; vertical-align: top; border-bottom: 1px solid #e5e5e5; padding: 5px 24px 5px 0; break-inside: avoid; }
.field.full { display: block; width: 100%; padding-right: 0; }
.field .label { font-size: 10px; color: #666666; margin: 0 0 1px; }
.field .value { font-size: 12.5px; font-weight: 600; color: #111111; margin: 0; overflow-wrap: anywhere; white-space: pre-wrap; }
.field .value.empty { font-style: italic; font-weight: 400; color: #999999; }
.field .value.restricted { font-weight: 500; color: #999999; }
.muted { font-size: 12px; color: #999999; font-style: italic; margin: 2px 0; }
.kv { margin: 0 0 8px; }
.kv-k { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #777777; margin-right: 8px; }
.kv-v { font-size: 12.5px; font-weight: 600; color: #111111; }
.tbl { width: 100%; border-collapse: collapse; font-size: 11.5px; }
.tbl th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; color: #777777; font-weight: 600; border-bottom: 1px solid #cccccc; padding: 4px 8px 4px 0; }
.tbl td { padding: 4px 8px 4px 0; border-bottom: 1px solid #ececec; color: #111111; break-inside: avoid; }
.tbl .num { text-align: right; white-space: nowrap; padding-right: 0; }
.team-list { list-style: none; margin: 0; padding: 0; font-size: 0; }
.team-list li { display: inline-block; width: 50%; vertical-align: top; padding: 4px 16px 4px 0; break-inside: avoid; }
.team-name { display: block; font-size: 12.5px; font-weight: 600; color: #111111; }
.team-role { display: block; font-size: 10px; color: #777777; }
.tl-list { list-style: none; margin: 0; padding: 0; }
.tl-list li { display: flex; gap: 12px; padding: 4px 0; border-bottom: 1px solid #f0f0f0; break-inside: avoid; }
.tl-ts { font-size: 10.5px; color: #777777; white-space: nowrap; min-width: 118px; }
.tl-body { display: flex; flex-direction: column; }
.tl-title { font-size: 12px; font-weight: 600; color: #111111; }
.tl-sub { font-size: 10.5px; color: #777777; text-transform: capitalize; }
`

// ── public API ─────────────────────────────────────────────────
export interface OpenEventFullPrintArgs {
  event: EventWithDetails
  checklists: ChecklistForList[]
  unitName: string | null
  canSeeValues: boolean
}

export async function openEventFullPrint({
  event,
  checklists,
  unitName,
  canSeeValues,
}: OpenEventFullPrintArgs): Promise<void> {
  // Open the window synchronously to keep the user-gesture (avoids pop-up block),
  // then fetch the lazy data and rewrite the document.
  const w = window.open('', '_blank')
  if (!w) {
    alert('Não foi possível abrir a janela de impressão. Verifique se o navegador bloqueou pop-ups para este site.')
    return
  }
  w.document.open()
  w.document.write(
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Preparando impressão…</title>' +
    '<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#555;padding:40px;font-size:14px}</style>' +
    '</head><body>Preparando impressão…</body></html>',
  )
  w.document.close()

  // Fetch the on-demand sections (Vendas products + Decoração da Festa).
  let products: SalesProductRow[] = []
  let festa: FestaDecoracaoPrintData | null = null
  try {
    const supabase = createClient()
    const [salesRes, festaRes] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).rpc('get_event_sales_summary', { p_event_id: event.id }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('decoracao_festa')
        .select(
          'tema:decoracao_temas(nome), itens:decoracao_festa_itens(quantidade, ordem, variacao:decoracao_item_variacoes(detalhe, item:decoracao_itens(nome)))',
        )
        .eq('event_id', event.id)
        .maybeSingle(),
    ])

    if (!salesRes.error && salesRes.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      products = ((salesRes.data.products ?? []) as any[]).map((p) => ({
        group_name: p.group_name ?? null,
        product_name: p.product_name ?? null,
        quantity: p.quantity ?? 0,
      }))
    }

    if (!festaRes.error && festaRes.data) {
      const fd = festaRes.data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itens: FestaItemRow[] = ((fd.itens ?? []) as any[])
        .map((row) => ({
          item_nome: (row.variacao?.item?.nome ?? '—') as string,
          detalhe: (row.variacao?.detalhe ?? null) as string | null,
          quantidade: (row.quantidade ?? 0) as number,
          ordem: (row.ordem ?? 0) as number,
        }))
        .sort((a, b) => a.ordem - b.ordem)
        .map(({ item_nome, detalhe, quantidade }) => ({ item_nome, detalhe, quantidade }))
      festa = { tema_nome: (fd.tema?.nome ?? null) as string | null, itens }
    }
  } catch {
    // Degrade gracefully — the affected sections render their empty state.
  }

  // If the user already closed the print tab, abort silently.
  if (w.closed) return

  const geradoEm = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date())

  const dataFmt = (() => {
    try {
      return format(parseISO(`${event.date}T00:00:00`), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
    } catch {
      return event.date ?? ''
    }
  })()

  const horario = `${timeValue(event.start_time)} – ${timeValue(event.end_time)}`
  const convidados =
    event.guest_count !== null && event.guest_count !== undefined
      ? `${event.guest_count}`
      : '—'
  const contratoLabel =
    event.contract_signed === true ? 'Assinado' : event.contract_signed === false ? 'Não assinado' : '—'
  const statusLabel = event.status === 'lost' ? 'Perdido' : 'Confirmado'

  const metaHtml =
    '<div class="meta">' +
    '<div><p class="k">Data da festa</p><p class="v cap">' + escapeHtml(dataFmt) + '</p></div>' +
    '<div><p class="k">Horário</p><p class="v">' + escapeHtml(horario) + '</p></div>' +
    '<div><p class="k">Unidade</p><p class="v">' + escapeHtml(unitName ?? '—') + '</p></div>' +
    '<div><p class="k">Cliente</p><p class="v">' + escapeHtml(event.client_name ?? '—') + '</p></div>' +
    '<div><p class="k">Convidados</p><p class="v">' + escapeHtml(convidados) + '</p></div>' +
    '<div><p class="k">Vendedora</p><p class="v">' + escapeHtml(event.owner_name ?? '—') + '</p></div>' +
    '<div><p class="k">Status</p><p class="v">' + escapeHtml(statusLabel) + '</p></div>' +
    '<div><p class="k">Contrato</p><p class="v">' + escapeHtml(contratoLabel) + '</p></div>' +
    '</div>'

  const clienteItems = buildChecklistClienteItems(event, canSeeValues)
  const decoracaoItems = buildChecklistDecoracaoItems(event, canSeeValues)

  const body =
    '<div class="header"><h1>Detalhes do Evento</h1><p class="subtitle">' +
    escapeHtml(event.title ?? '') + (event.theme ? ' · ' + escapeHtml(event.theme) : '') +
    '</p></div>' +
    metaHtml +
    partyInfoSection(event) +
    logisticsSection(event) +
    clientSection(event) +
    section('Checklist do Cliente', renderFields(clienteItems)) +
    section('Checklist de Decoração', renderFields(decoracaoItems)) +
    salesSection(products) +
    teamSection(event) +
    festaDecoracaoSection(festa) +
    historySection(event, checklists)

  const titleStr = 'Detalhes - ' + (event.client_name ?? event.title ?? '') + ' - ' + (event.date ?? '')

  const html =
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
    '<title>' + escapeHtml(titleStr) + '</title>' +
    '<style>' + STYLES.replace('GERADO_EM', geradoEm) + '</style></head><body>' +
    body +
    '<script>window.addEventListener("load",function(){window.focus();setTimeout(function(){window.print();},250);});</script>' +
    '</body></html>'

  w.document.open()
  w.document.write(html)
  w.document.close()
}
