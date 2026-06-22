import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Event } from '@/types/database.types'

export const NAO_PREENCHIDO = 'não preenchido'
export const RESTRITO = 'Restrito'

export interface ChecklistClienteItem {
  label: string
  value: string
  restricted?: boolean
  multiline?: boolean
}

function boolLabel(v: boolean | null | undefined): string {
  return v ? 'Sim' : 'Não'
}
function textValue(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return NAO_PREENCHIDO
  const s = String(v).trim()
  return s === '' ? NAO_PREENCHIDO : s
}
function timeValue(v: string | null | undefined): string {
  if (!v) return NAO_PREENCHIDO
  return v.slice(0, 5)
}
function currencyValue(v: number | null | undefined): string {
  if (v === null || v === undefined) return NAO_PREENCHIDO
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function buildChecklistClienteItems(event: Event, canSeeValues: boolean): ChecklistClienteItem[] {
  const extraGuestValue: ChecklistClienteItem = canSeeValues
    ? { label: 'Valor do Convidado Extra e Staff', value: currencyValue(event.extra_guest_staff_value) }
    : { label: 'Valor do Convidado Extra e Staff', value: RESTRITO, restricted: true }

  return [
    { label: 'Número de convidados adultos', value: textValue(event.adult_count) },
    { label: 'Número de convidados até 4 anos', value: textValue(event.kids_under4) },
    { label: 'Número de convidados acima de 5 anos', value: textValue(event.kids_over5) },
    { label: 'Decoração alinhada?', value: boolLabel(event.decoration_aligned) },
    { label: 'Comprou doces decorados?', value: boolLabel(event.has_decorated_sweets) },
    { label: 'Teremos algum show?', value: boolLabel(event.has_show) },
    { label: 'Bebidas de fora', value: boolLabel(event.outside_drinks) },
    { label: 'Lembrancinhas', value: boolLabel(event.party_favors) },
    { label: 'Quantidade Rolha', value: textValue(event.corkage_quantity) },
    extraGuestValue,
    { label: 'Responsável', value: textValue(event.responsible_person) },
    { label: 'Nome do pai', value: textValue(event.father_name) },
    { label: 'Contratou foto e/ou vídeo?', value: textValue(event.photo_video) },
    { label: 'Horário do Show', value: timeValue(event.show_time) },
    { label: 'Músicas', value: textValue(event.music) },
    { label: 'Contato(s) foto e/ou vídeo', value: textValue(event.photo_video_contact), multiline: true },
    { label: 'Gerador', value: textValue(event.generator), multiline: true },
    { label: 'Valet custos', value: textValue(event.valet_cost), multiline: true },
    { label: 'Outros detalhes Checklist Cliente', value: textValue(event.checklist_other_details), multiline: true },
    { label: 'Pagou Rolha?', value: textValue(event.corkage_paid), multiline: true },
    { label: 'Detalhamento de Hora Extra', value: textValue(event.overtime_details), multiline: true },
  ]
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

interface OpenPrintArgs {
  event: Event
  unitName: string | null
  canSeeValues: boolean
}

export function openChecklistClientePrint({ event, unitName, canSeeValues }: OpenPrintArgs): void {
  const items = buildChecklistClienteItems(event, canSeeValues)

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

  const fieldsHtml = items
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
    .join('')

  const titleStr = 'Checklist - ' + (event.client_name ?? event.title ?? '') + ' - ' + (event.date ?? '')

  const html =
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
    '<title>' + escapeHtml(titleStr) + '</title>' +
    '<style>' +
    '@page { size: A4; margin: 0 0 12mm 0; @bottom-left { content: "Gerado por CacholaOS — ' + geradoEm + '"; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 9px; color: #888888; padding-left: 14mm; border-top: 1px solid #e5e5e5; } @bottom-right { content: counter(page) "/" counter(pages); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 9px; color: #888888; padding-right: 14mm; border-top: 1px solid #e5e5e5; } }' +
    '* { box-sizing: border-box; }' +
    'html, body { margin: 0; padding: 0; }' +
    'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111; font-size: 12px; line-height: 1.35; padding: 14mm; }' +
    '.header { border-bottom: 1px solid #cccccc; padding-bottom: 8px; margin-bottom: 12px; }' +
    '.header h1 { font-size: 18px; margin: 0 0 2px; }' +
    '.header .subtitle { font-size: 12px; color: #444444; margin: 0; }' +
    '.meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 16px; margin-bottom: 14px; }' +
    '.meta .k { font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; color: #777777; margin: 0; }' +
    '.meta .v { font-size: 12px; margin: 2px 0 0; }' +
    '.meta .v.cap { text-transform: capitalize; }' +
    '.items-title { font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; color: #777777; margin: 0 0 6px; }' +
    '.items { font-size: 0; }' +
    '.field { display: inline-block; width: 50%; vertical-align: top; border-bottom: 1px solid #e5e5e5; padding: 5px 24px 5px 0; break-inside: avoid; }' +
    '.field.full { display: block; width: 100%; padding-right: 0; }' +
    '.field .label { font-size: 10px; color: #666666; margin: 0 0 1px; }' +
    '.field .value { font-size: 12.5px; font-weight: 600; color: #111111; margin: 0; overflow-wrap: anywhere; white-space: pre-wrap; }' +
    '.field .value.empty { font-style: italic; font-weight: 400; color: #999999; }' +
    '.field .value.restricted { font-weight: 500; color: #999999; }' +
    '</style></head><body>' +
    '<div class="header"><h1>Checklist do Cliente</h1><p class="subtitle">' + escapeHtml(event.title ?? '') + '</p></div>' +
    '<div class="meta">' +
    '<div><p class="k">Data da festa</p><p class="v cap">' + escapeHtml(dataFmt) + '</p></div>' +
    '<div><p class="k">Unidade</p><p class="v">' + escapeHtml(unitName ?? '—') + '</p></div>' +
    '<div><p class="k">Cliente</p><p class="v">' + escapeHtml(event.client_name ?? '—') + '</p></div>' +
    '</div>' +
    '<p class="items-title">Itens (' + items.length + ')</p>' +
    '<div class="items">' + fieldsHtml + '</div>' +
    '<script>window.addEventListener("load",function(){window.focus();setTimeout(function(){window.print();},250);});</script>' +
    '</body></html>'

  const w = window.open('', '_blank')
  if (!w) {
    alert('Não foi possível abrir a janela de impressão. Verifique se o navegador bloqueou pop-ups para este site.')
    return
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
}
