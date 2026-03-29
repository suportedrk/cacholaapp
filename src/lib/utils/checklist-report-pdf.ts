/**
 * generateChecklistReportPDF — relatório completo de checklist com fotos,
 * comentários e área de assinaturas. Usa jsPDF (já instalado no projeto).
 */

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '')
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  return [isNaN(r) ? 124 : r, isNaN(g) ? 141 : g, isNaN(b) ? 120 : b]
}

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type ChecklistReportItem = {
  index:           number
  description:     string
  status:          'pending' | 'done' | 'na'
  priorityLabel:   string | null
  responsibleName: string | null
  estimatedMin:    number | null
  notes:           string | null
}

export type ChecklistReportPhoto = {
  itemDescription: string
  dataUrl:         string     // base64 JPEG already resized
  aspectRatio:     number     // width / height
  takenAt:         string | null
  takenBy:         string | null
}

export type ChecklistReportCommentGroup = {
  itemDescription: string
  entries: { author: string; content: string; createdAt: string }[]
}

export type ChecklistReportOptions = {
  unitName:          string
  accentHex?:        string
  checklistTitle:    string
  checklistType:     string
  priorityLabel:     string | null
  eventTitle:        string | null
  eventDate:         string | null
  responsibleName:   string | null
  createdAt:         string | null
  completedAt:       string | null
  completedByName:   string | null
  doneCount:         number
  totalCount:        number
  totalEstimatedMin: number
  items:             ChecklistReportItem[]
  photos:            ChecklistReportPhoto[]
  commentGroups:     ChecklistReportCommentGroup[]
  includePhotos:     boolean
  includeComments:   boolean
  includeSignatures: boolean
  filename:          string
}

// ─────────────────────────────────────────────────────────────
// MAIN FUNCTION
// ─────────────────────────────────────────────────────────────

export async function generateChecklistReportPDF(opts: ChecklistReportOptions): Promise<void> {
  const { default: jsPDF } = await import('jspdf')

  const {
    unitName, accentHex = '#7C8D78',
    checklistTitle, checklistType, priorityLabel,
    eventTitle, eventDate, responsibleName,
    createdAt, completedAt, completedByName,
    doneCount, totalCount, totalEstimatedMin,
    items, photos, commentGroups,
    includePhotos, includeComments, includeSignatures,
    filename,
  } = opts

  const pdf   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()   // 210mm
  const pageH = pdf.internal.pageSize.getHeight()  // 297mm
  const mg    = 16
  const cW    = pageW - mg * 2  // 178mm
  const [ar, ag, ab] = hexToRgb(accentHex)

  // ── helpers ──────────────────────────────────────
  const fmtMin = (m: number) => {
    if (m < 60) return `${m}min`
    const h = Math.floor(m / 60); const r = m % 60
    return r ? `${h}h ${r}min` : `${h}h`
  }

  function drawPageBar(): number {
    pdf.setFillColor(ar, ag, ab)
    pdf.rect(0, 0, pageW, 9, 'F')
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(255, 255, 255)
    pdf.text(`Cachola OS  -  ${unitName}`, mg, 6)
    pdf.text(new Date().toLocaleDateString('pt-BR'), pageW - mg, 6, { align: 'right' })
    pdf.setTextColor(0, 0, 0)
    return 14
  }

  function drawFooter() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalPages = (pdf as any).internal.getNumberOfPages()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cur        = (pdf as any).internal.getCurrentPageInfo().pageNumber
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    pdf.setTextColor(150, 150, 150)
    pdf.text('Gerado por Cachola OS', mg, pageH - 6)
    pdf.text(`Pagina ${cur} de ${totalPages}`, pageW - mg, pageH - 6, { align: 'right' })
    pdf.setTextColor(0, 0, 0)
  }

  function drawSection(y: number, label: string): number {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9.5)
    pdf.setTextColor(ar, ag, ab)
    pdf.text(label, mg, y)
    pdf.setDrawColor(ar, ag, ab)
    pdf.setLineWidth(0.35)
    pdf.line(mg, y + 1.5, pageW - mg, y + 1.5)
    pdf.setLineWidth(0.2)
    pdf.setTextColor(0, 0, 0)
    return y + 7
  }

  function checkSpace(y: number, needed: number): number {
    if (y + needed > pageH - 16) {
      drawFooter()
      pdf.addPage()
      return drawPageBar()
    }
    return y
  }

  // ════════════════════════════════════════════════
  // PAGE 1: title + info box + items table
  // ════════════════════════════════════════════════
  let y = drawPageBar()

  // Title
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(14)
  pdf.setTextColor(25, 25, 25)
  pdf.text('Relatorio de Checklist', mg, y + 7)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(80, 80, 80)
  pdf.text(checklistTitle, mg, y + 14)
  y += 21

  // ── INFORMACOES GERAIS ────────────────────────────
  y = drawSection(y, 'INFORMACOES GERAIS')

  const infoRows: [string, string][] = [
    ['Tipo',         checklistType],
    ...(priorityLabel   ? [['Prioridade',   priorityLabel]   as [string, string]] : []),
    ...(eventTitle      ? [['Evento',        eventTitle]      as [string, string]] : []),
    ...(eventDate       ? [['Data',          new Date(eventDate + 'T12:00:00').toLocaleDateString('pt-BR')] as [string, string]] : []),
    ...(responsibleName ? [['Responsavel',   responsibleName] as [string, string]] : []),
    ...(createdAt       ? [['Criado em',     new Date(createdAt).toLocaleString('pt-BR')]   as [string, string]] : []),
    ...(completedAt     ? [['Concluido em',  new Date(completedAt).toLocaleString('pt-BR')] as [string, string]] : []),
    ...(completedByName ? [['Concluido por', completedByName] as [string, string]] : []),
    ['Progresso', `${doneCount}/${totalCount} itens (${Math.round((doneCount / Math.max(totalCount, 1)) * 100)}%)`],
    ...(totalEstimatedMin > 0 ? [['Tempo est.', fmtMin(totalEstimatedMin)] as [string, string]] : []),
  ]

  const half   = Math.ceil(infoRows.length / 2)
  const colA   = infoRows.slice(0, half)
  const colB   = infoRows.slice(half)
  const iLineH = 6
  const boxH   = Math.max(colA.length, colB.length) * iLineH + 8

  pdf.setFillColor(246, 248, 246)
  pdf.setDrawColor(210, 220, 210)
  pdf.setLineWidth(0.2)
  pdf.roundedRect(mg, y, cW, boxH, 2, 2, 'FD')

  const lX = mg + 4; const lX2 = mg + cW / 2 + 4; const vOff = 28
  let bY = y + 7

  for (let i = 0; i < Math.max(colA.length, colB.length); i++) {
    const drawPair = (row: [string, string], x: number) => {
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7.5)
      pdf.setTextColor(90, 90, 90)
      pdf.text(row[0] + ':', x, bY)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(25, 25, 25)
      pdf.text(row[1], x + vOff, bY, { maxWidth: cW / 2 - vOff - 6 })
    }
    if (colA[i]) drawPair(colA[i], lX)
    if (colB[i]) drawPair(colB[i], lX2)
    bY += iLineH
  }
  y += boxH + 8

  // ── ITENS DO CHECKLIST ───────────────────────────
  y = drawSection(y, 'ITENS DO CHECKLIST')

  const tc = {
    idx:    { x: mg,       w: 8  },
    desc:   { x: mg + 8,   w: 82 },
    status: { x: mg + 90,  w: 26 },
    resp:   { x: mg + 116, w: 30 },
    time:   { x: mg + 146, w: 32 },
  }

  // Table header
  pdf.setFillColor(ar, ag, ab)
  pdf.rect(mg, y, cW, 7.5, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7.5)
  pdf.setTextColor(255, 255, 255)
  pdf.text('#',           tc.idx.x + 2,    y + 5)
  pdf.text('Descricao',   tc.desc.x + 2,   y + 5)
  pdf.text('Status',      tc.status.x + 2, y + 5)
  pdf.text('Responsavel', tc.resp.x + 2,   y + 5)
  pdf.text('Tempo',       tc.time.x + 2,   y + 5)
  y += 7.5

  items.forEach((item, idx) => {
    const needH = 7.5 + (item.notes ? 5.5 : 0)
    y = checkSpace(y, needH)

    if (idx % 2 === 0) {
      pdf.setFillColor(248, 250, 248)
      pdf.rect(mg, y, cW, 7.5, 'F')
    }

    // index
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    pdf.setTextColor(130, 130, 130)
    pdf.text(String(item.index), tc.idx.x + 2, y + 4.8)

    // description
    const dGray = item.status === 'na' ? 150 : 25
    pdf.setTextColor(dGray, dGray, dGray)
    pdf.text(item.description, tc.desc.x + 2, y + 4.8, { maxWidth: tc.desc.w - 4 })

    // status
    let sym = 'o'; let sR = 150, sG = 150, sB = 150; let sLabel = 'Pendente'
    if (item.status === 'done') { sym = '+'; sR = 34;  sG = 120; sB = 60; sLabel = 'Feito' }
    if (item.status === 'na')   { sym = '-'; sLabel = 'N/A' }

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(sR, sG, sB)
    pdf.text(sym, tc.status.x + 2, y + 5.3)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.text(sLabel, tc.status.x + 8, y + 4.8)

    // responsible
    if (item.responsibleName) {
      pdf.setFontSize(7.5)
      pdf.setTextColor(50, 50, 50)
      pdf.text(item.responsibleName.split(' ')[0], tc.resp.x + 2, y + 4.8, { maxWidth: tc.resp.w - 4 })
    }

    // time
    if (item.estimatedMin && item.estimatedMin > 0) {
      pdf.setFontSize(7.5)
      pdf.setTextColor(80, 80, 80)
      pdf.text(fmtMin(item.estimatedMin), tc.time.x + 2, y + 4.8)
    }

    // row separator
    pdf.setDrawColor(230, 235, 230)
    pdf.setLineWidth(0.1)
    pdf.line(mg, y + 7.5, mg + cW, y + 7.5)
    y += 7.5

    // notes (indented)
    if (item.notes) {
      y = checkSpace(y, 5.5)
      pdf.setFont('helvetica', 'italic')
      pdf.setFontSize(7)
      pdf.setTextColor(100, 100, 100)
      pdf.text(item.notes, tc.desc.x + 4, y + 3.5, { maxWidth: tc.desc.w + tc.status.w - 6 })
      y += 5.5
    }
  })

  // time total row
  if (totalEstimatedMin > 0) {
    y = checkSpace(y, 8); y += 3
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(80, 80, 80)
    pdf.text(`Tempo estimado total: ${fmtMin(totalEstimatedMin)}`, mg, y)
    y += 6
  }

  // ════════════════════════════════════════════════
  // EVIDENCIAS FOTOGRAFICAS
  // ════════════════════════════════════════════════
  if (includePhotos && photos.length > 0) {
    drawFooter()
    pdf.addPage()
    y = drawPageBar()
    y = drawSection(y, 'EVIDENCIAS FOTOGRAFICAS')

    photos.forEach((photo) => {
      const photoW = cW
      const photoH = Math.min(photoW / photo.aspectRatio, 110)
      y = checkSpace(y, photoH + 22)

      // item label
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(8.5)
      pdf.setTextColor(40, 40, 40)
      pdf.text(photo.itemDescription, mg, y, { maxWidth: cW })
      y += 6

      // photo
      pdf.setDrawColor(210, 210, 210)
      pdf.setLineWidth(0.3)
      pdf.rect(mg, y, photoW, photoH)
      try {
        pdf.addImage(photo.dataUrl, 'JPEG', mg, y, photoW, photoH)
      } catch {
        pdf.setFillColor(240, 240, 240)
        pdf.rect(mg, y, photoW, photoH, 'F')
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(8)
        pdf.setTextColor(150, 150, 150)
        pdf.text('Imagem indisponivel', mg + photoW / 2, y + photoH / 2, { align: 'center' })
      }
      y += photoH + 2

      // meta
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7)
      pdf.setTextColor(120, 120, 120)
      const metaParts: string[] = []
      if (photo.takenBy) metaParts.push(`Por: ${photo.takenBy}`)
      if (photo.takenAt) {
        metaParts.push(`Registrado: ${new Date(photo.takenAt).toLocaleString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
        })}`)
      }
      if (metaParts.length) pdf.text(metaParts.join('   |   '), mg, y + 3.5)
      y += 10
    })
  }

  // ════════════════════════════════════════════════
  // OBSERVACOES E COMENTARIOS
  // ════════════════════════════════════════════════
  const activeGroups = commentGroups.filter((g) => g.entries.length > 0)
  if (includeComments && activeGroups.length > 0) {
    drawFooter()
    pdf.addPage()
    y = drawPageBar()
    y = drawSection(y, 'OBSERVACOES E COMENTARIOS')

    activeGroups.forEach((group) => {
      y = checkSpace(y, 16)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(8.5)
      pdf.setTextColor(40, 40, 40)
      pdf.text(group.itemDescription, mg, y)
      y += 5

      group.entries.forEach((entry) => {
        const lines    = pdf.splitTextToSize(entry.content, cW - 10)
        const entryNeed = lines.length * 4.5 + 8
        y = checkSpace(y, entryNeed)

        const dt = new Date(entry.createdAt).toLocaleString('pt-BR', {
          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
        })
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(7)
        pdf.setTextColor(70, 70, 70)
        pdf.text(`${entry.author}  (${dt})`, mg + 4, y)
        y += 4.5

        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(8)
        pdf.setTextColor(30, 30, 30)
        pdf.text(lines, mg + 4, y)
        y += lines.length * 4.5 + 2

        pdf.setDrawColor(235, 235, 235)
        pdf.setLineWidth(0.1)
        pdf.line(mg + 4, y, pageW - mg, y)
        y += 2
      })
      y += 5
    })
  }

  // ════════════════════════════════════════════════
  // ASSINATURAS
  // ════════════════════════════════════════════════
  if (includeSignatures) {
    drawFooter()
    pdf.addPage()
    y = drawPageBar()
    y = drawSection(y, 'ASSINATURAS')

    const sigLineW = 74; const dateLineW = 32; const gap = 10

    ;([
      [y + 20, 'Responsavel'],
      [y + 65, 'Supervisor'],
    ] as [number, string][]).forEach(([sigY, label]) => {
      pdf.setDrawColor(ar, ag, ab)
      pdf.setLineWidth(0.4)
      pdf.line(mg, sigY, mg + sigLineW, sigY)
      pdf.line(mg + sigLineW + gap, sigY, mg + sigLineW + gap + dateLineW, sigY)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor(100, 100, 100)
      pdf.text(label, mg, sigY + 5)
      pdf.text('Data', mg + sigLineW + gap, sigY + 5)
    })

    const tsY = y + 110
    pdf.setDrawColor(210, 210, 210)
    pdf.setLineWidth(0.2)
    pdf.line(mg, tsY, pageW - mg, tsY)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    pdf.setTextColor(130, 130, 130)
    pdf.text(
      `Gerado automaticamente pelo Cachola OS em ${new Date().toLocaleString('pt-BR')}`,
      mg, tsY + 5,
    )
  }

  drawFooter()
  pdf.save(`${filename}.pdf`)
}
