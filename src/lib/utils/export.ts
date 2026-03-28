/**
 * Utilitários de exportação — Excel (xlsx), PDF element capture (jsPDF + html2canvas),
 * PDF programático de relatório e PDF programático de checklist concluído.
 * Importações dinâmicas para não inflar o bundle das outras páginas.
 */

// ─────────────────────────────────────────────────────────────
// EXCEL — SheetJS
// ─────────────────────────────────────────────────────────────

type SheetRow = Record<string, string | number | null | undefined>

export async function exportToExcel(
  rows:     SheetRow[],
  columns:  { key: string; header: string }[],
  filename: string
) {
  const XLSX = await import('xlsx')

  const header = columns.map((c) => c.header)
  const data   = rows.map((r) => columns.map((c) => r[c.key] ?? ''))

  const ws = XLSX.utils.aoa_to_sheet([header, ...data])

  // Largura automática das colunas
  ws['!cols'] = columns.map(() => ({ wch: 20 }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Relatório')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// ─────────────────────────────────────────────────────────────
// PDF — jsPDF + html2canvas
// ─────────────────────────────────────────────────────────────

export async function exportToPDF(
  elementId: string,
  title:     string,
  unit:      string,
  period:    string,
  filename:  string
) {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ])

  const element = document.getElementById(elementId)
  if (!element) {
    console.error(`[exportToPDF] Element #${elementId} not found`)
    return
  }

  // Captura do elemento como canvas
  const canvas = await html2canvas(element, {
    scale:           1.5,
    useCORS:         true,
    backgroundColor: '#ffffff',
    logging:         false,
  })

  const imgData = canvas.toDataURL('image/jpeg', 0.9)
  const pdf     = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  const pageW  = pdf.internal.pageSize.getWidth()
  const pageH  = pdf.internal.pageSize.getHeight()
  const margin = 12

  // Cabeçalho
  pdf.setFillColor(124, 141, 120) // #7C8D78
  pdf.rect(0, 0, pageW, 16, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Cachola OS', margin, 10)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text(`${title}  •  ${unit}  •  ${period}`, margin + 28, 10)

  // Imagem do conteúdo
  const contentY = 20
  const imgW     = pageW - margin * 2
  const imgH     = (canvas.height * imgW) / canvas.width

  // Se a imagem for maior que a página, paginar
  if (imgH <= pageH - contentY - margin) {
    pdf.addImage(imgData, 'JPEG', margin, contentY, imgW, imgH)
  } else {
    // Divide em páginas
    const ratio = imgH / imgW
    let srcY    = 0
    let first   = true

    while (srcY < canvas.height) {
      if (!first) pdf.addPage()
      first = false

      const availH   = pageH - (first ? contentY : margin) - margin
      const sliceH   = Math.min(availH / ratio, canvas.height - srcY)
      const pageImgH = sliceH * ratio

      // Criar canvas temporário para o slice
      const sliceCanvas    = document.createElement('canvas')
      sliceCanvas.width    = canvas.width
      sliceCanvas.height   = sliceH
      const ctx            = sliceCanvas.getContext('2d')!
      ctx.drawImage(canvas, 0, -srcY)
      const sliceData      = sliceCanvas.toDataURL('image/jpeg', 0.9)

      pdf.addImage(sliceData, 'JPEG', margin, first ? contentY : margin, imgW, pageImgH)
      srcY += sliceH
    }
  }

  pdf.save(`${filename}.pdf`)
}

// ─────────────────────────────────────────────────────────────
// HELPERS internos
// ─────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return [isNaN(r) ? 124 : r, isNaN(g) ? 141 : g, isNaN(b) ? 120 : b]
}

/** Adds a page header and returns the Y position right after it */
function addPdfHeader(
  pdf:         InstanceType<typeof import('jspdf').jsPDF>,
  title:       string,
  unitName:    string,
  period:      string,
  accentHex:   string,
  pageW:       number,
  margin:      number,
): number {
  const [r, g, b] = hexToRgb(accentHex)
  pdf.setFillColor(r, g, b)
  pdf.rect(0, 0, pageW, 18, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text('Cachola OS', margin, 11)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8.5)
  pdf.text(`${unitName}  •  ${period}`, pageW / 2, 11, { align: 'center' })
  pdf.text(new Date().toLocaleDateString('pt-BR'), pageW - margin, 11, { align: 'right' })
  pdf.setTextColor(0, 0, 0)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13)
  pdf.text(title, margin, 30)
  return 36
}

/** Adds page footer with page number */
function addPdfFooter(
  pdf:      InstanceType<typeof import('jspdf').jsPDF>,
  pageW:   number,
  margin:  number,
  pageH:   number,
) {
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(150, 150, 150)
  pdf.text('Gerado por Cachola OS', margin, pageH - 6)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalPages = (pdf as any).internal.getNumberOfPages()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentPage = (pdf as any).internal.getCurrentPageInfo().pageNumber
  pdf.text(`Página ${currentPage} de ${totalPages}`, pageW - margin, pageH - 6, { align: 'right' })
  pdf.setTextColor(0, 0, 0)
}

// ─────────────────────────────────────────────────────────────
// PDF DE RELATÓRIO — programático, sem html2canvas
// ─────────────────────────────────────────────────────────────

export type ReportPdfColumn = {
  header: string
  key: string
  align?: 'left' | 'right' | 'center'
  width?: number  // mm
}

export type ReportPdfConfig = {
  title:      string
  unitName:   string
  period:     string
  accentHex?: string
  columns:    ReportPdfColumn[]
  rows:       Record<string, string | number | null | undefined>[]
  filename:   string
}

export async function exportReportPDF(config: ReportPdfConfig) {
  const { default: jsPDF } = await import('jspdf')

  const {
    title, unitName, period,
    accentHex = '#7C8D78',
    columns, rows, filename,
  } = config

  const pdf    = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW  = pdf.internal.pageSize.getWidth()
  const pageH  = pdf.internal.pageSize.getHeight()
  const margin = 14

  let y = addPdfHeader(pdf, title, unitName, period, accentHex, pageW, margin)

  const tableWidth = pageW - margin * 2
  // Auto column widths: split evenly unless width specified
  const totalFixed   = columns.reduce((s, c) => s + (c.width ?? 0), 0)
  const flexCount    = columns.filter((c) => !c.width).length
  const flexWidth    = flexCount > 0 ? (tableWidth - totalFixed) / flexCount : 0
  const colWidths    = columns.map((c) => c.width ?? flexWidth)

  const rowH   = 7
  const headH  = 8
  const [r, g, b] = hexToRgb(accentHex)

  // ── Table header ──
  pdf.setFillColor(r, g, b)
  pdf.rect(margin, y, tableWidth, headH, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8.5)
  let xPos = margin
  columns.forEach((col, i) => {
    const cw   = colWidths[i]
    const align = col.align ?? 'left'
    const tx = align === 'right' ? xPos + cw - 2 : align === 'center' ? xPos + cw / 2 : xPos + 2
    pdf.text(col.header, tx, y + 5.5, { align })
    xPos += cw
  })
  y += headH

  // ── Rows ──
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)

  rows.forEach((row, rowIdx) => {
    if (y + rowH > pageH - 14) {
      addPdfFooter(pdf, pageW, margin, pageH)
      pdf.addPage()
      y = margin + 6
    }

    // Alternating rows
    if (rowIdx % 2 === 0) {
      pdf.setFillColor(248, 248, 248)
      pdf.rect(margin, y, tableWidth, rowH, 'F')
    }

    pdf.setTextColor(30, 30, 30)
    xPos = margin
    columns.forEach((col, i) => {
      const cw    = colWidths[i]
      const val   = String(row[col.key] ?? '—')
      const align = col.align ?? 'left'
      const tx    = align === 'right' ? xPos + cw - 2 : align === 'center' ? xPos + cw / 2 : xPos + 2
      pdf.text(val, tx, y + 4.8, { align })
      xPos += cw
    })

    // Bottom border
    pdf.setDrawColor(220, 220, 220)
    pdf.line(margin, y + rowH, margin + tableWidth, y + rowH)
    y += rowH
  })

  addPdfFooter(pdf, pageW, margin, pageH)
  pdf.save(`${filename}.pdf`)
}

// ─────────────────────────────────────────────────────────────
// PDF DE CHECKLIST CONCLUÍDO — programático, sem html2canvas
// ─────────────────────────────────────────────────────────────

export type ChecklistPdfItem = {
  description: string
  status:      'pending' | 'done' | 'na'
  notes?:      string | null
  done_by?:    string | null
  done_at?:    string | null
}

export type ChecklistPdfConfig = {
  title:        string
  eventTitle?:  string
  clientName?:  string
  eventDate?:   string
  venueName?:   string
  unitName:     string
  responsible?: string
  items:        ChecklistPdfItem[]
  accentHex?:   string
  filename:     string
}

export async function exportChecklistPDF(config: ChecklistPdfConfig) {
  const { default: jsPDF } = await import('jspdf')

  const {
    title, eventTitle, clientName, eventDate, venueName,
    unitName, responsible,
    items,
    accentHex = '#7C8D78',
    filename,
  } = config

  const pdf    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW  = pdf.internal.pageSize.getWidth()
  const pageH  = pdf.internal.pageSize.getHeight()
  const margin = 20

  const period = eventDate
    ? new Date(eventDate + 'T12:00:00').toLocaleDateString('pt-BR')
    : new Date().toLocaleDateString('pt-BR')

  let y = addPdfHeader(pdf, title, unitName, period, accentHex, pageW, margin)

  // ── Event summary box ──
  if (eventTitle || clientName || venueName) {
    const [r, g, b] = hexToRgb(accentHex)
    pdf.setFillColor(r, g, b, 0.08)
    // Light tinted background box
    pdf.setFillColor(245, 247, 245)
    pdf.setDrawColor(r, g, b)
    pdf.roundedRect(margin, y, pageW - margin * 2, 24, 2, 2, 'FD')

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8.5)
    pdf.setTextColor(60, 60, 60)

    const mid = margin + (pageW - margin * 2) / 2
    let infoY = y + 7
    if (eventTitle) {
      pdf.setFont('helvetica', 'bold')
      pdf.text(eventTitle, margin + 4, infoY)
      pdf.setFont('helvetica', 'normal')
    }
    infoY += 5
    const parts: string[] = []
    if (clientName)  parts.push(`Cliente: ${clientName}`)
    if (venueName)   parts.push(`Salão: ${venueName}`)
    if (eventDate)   parts.push(`Data: ${period}`)
    pdf.text(parts.slice(0, 2).join('   •   '), margin + 4, infoY)
    if (parts.length > 2) pdf.text(parts.slice(2).join('   •   '), mid, infoY)

    y += 30
  }

  // ── Summary stats ──
  const total   = items.length
  const done    = items.filter((it) => it.status === 'done').length
  const pending = items.filter((it) => it.status === 'pending').length
  const na      = items.filter((it) => it.status === 'na').length

  pdf.setFontSize(8.5)
  pdf.setTextColor(80, 80, 80)
  pdf.setFont('helvetica', 'normal')
  pdf.text(
    `Concluídos: ${done}/${total}   •   Pendentes: ${pending}   •   N/A: ${na}${responsible ? `   •   Responsável: ${responsible}` : ''}`,
    margin, y
  )
  y += 7

  // ── Divider ──
  const [r, g, b] = hexToRgb(accentHex)
  pdf.setDrawColor(r, g, b)
  pdf.setLineWidth(0.5)
  pdf.line(margin, y, pageW - margin, y)
  pdf.setLineWidth(0.2)
  y += 5

  // ── Items table ──
  const rowH   = 7.5
  const checkW = 8
  const tableW = pageW - margin * 2

  items.forEach((item) => {
    if (y + rowH > pageH - 18) {
      addPdfFooter(pdf, pageW, margin, pageH)
      pdf.addPage()
      y = margin + 6
    }

    // Checkbox symbol
    pdf.setFontSize(10)
    let symbol = '○'
    let symbolColor: [number, number, number] = [150, 150, 150]
    if (item.status === 'done') { symbol = '✓'; symbolColor = [34, 197, 94] }
    if (item.status === 'na')   { symbol = '—'; symbolColor = [150, 150, 150] }

    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(...symbolColor)
    pdf.text(symbol, margin, y + 5)

    // Description
    pdf.setFontSize(9)
    pdf.setFont('helvetica', item.status === 'na' ? 'normal' : 'normal')
    pdf.setTextColor(item.status === 'na' ? 150 : 30, item.status === 'na' ? 150 : 30, item.status === 'na' ? 150 : 30)
    pdf.text(item.description, margin + checkW, y + 5, { maxWidth: tableW - checkW - 40 })

    // Done by / date (right side)
    if (item.done_by || item.done_at) {
      pdf.setFontSize(7.5)
      pdf.setTextColor(130, 130, 130)
      const info = [
        item.done_at ? new Date(item.done_at).toLocaleDateString('pt-BR') : '',
        item.done_by ? item.done_by : '',
      ].filter(Boolean).join(' · ')
      pdf.text(info, pageW - margin, y + 5, { align: 'right' })
    }

    y += rowH

    // Notes (indented)
    if (item.notes) {
      if (y + 5 > pageH - 18) {
        addPdfFooter(pdf, pageW, margin, pageH)
        pdf.addPage()
        y = margin + 6
      }
      pdf.setFontSize(7.5)
      pdf.setTextColor(100, 100, 100)
      pdf.setFont('helvetica', 'italic')
      pdf.text(`↳ ${item.notes}`, margin + checkW, y + 3.5, { maxWidth: tableW - checkW - 4 })
      y += 6
    }

    // Row separator
    pdf.setDrawColor(235, 235, 235)
    pdf.line(margin + checkW, y, pageW - margin, y)
    y += 1
  })

  // ── Signature footer ──
  if (y + 25 > pageH - 18) {
    addPdfFooter(pdf, pageW, margin, pageH)
    pdf.addPage()
    y = margin + 6
  }
  y += 8
  pdf.setDrawColor(r, g, b)
  pdf.setLineWidth(0.5)
  pdf.line(margin, y, pageH - 12, y)   // half-width signature line
  pdf.setFontSize(8)
  pdf.setTextColor(120, 120, 120)
  pdf.setFont('helvetica', 'normal')
  pdf.text('Assinatura do responsável', margin, y + 5)
  pdf.text(
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    pageW - margin, y + 5,
    { align: 'right' }
  )

  addPdfFooter(pdf, pageW, margin, pageH)
  pdf.save(`${filename}.pdf`)
}
