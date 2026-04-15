/**
 * generateMeetingMinutePDF — relatório completo de ata de reunião.
 * Usa jsPDF (já instalado no projeto, v4). Sem dependências adicionais.
 * Client-side only — dynamic import, download direto via pdf.save().
 */

import { PARTICIPANT_ROLE_LABELS, ACTION_ITEM_STATUS_LABELS } from '@/types/minutes'
import type { MeetingMinuteDetail } from '@/types/minutes'

// ─────────────────────────────────────────────────────────────
// COLORS
// ─────────────────────────────────────────────────────────────

const SAGE: [number, number, number]  = [124, 141, 120]  // #7C8D78
const BEIGE: [number, number, number] = [227, 218, 209]  // #E3DAD1
const DARK: [number, number, number]  = [25,  25,  25]
const MID: [number, number, number]   = [80,  80,  80]
const LIGHT: [number, number, number] = [150, 150, 150]

// ─────────────────────────────────────────────────────────────
// STATUS LABELS
// ─────────────────────────────────────────────────────────────

const MEETING_STATUS_PT: Record<string, string> = {
  draft:     'Rascunho',
  published: 'Publicada',
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────

export async function generateMeetingMinutePDF(minute: MeetingMinuteDetail): Promise<void> {
  const { default: jsPDF } = await import('jspdf')

  const pdf   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()   // 210mm
  const pageH = pdf.internal.pageSize.getHeight()  // 297mm
  const mg    = 16
  const cW    = pageW - mg * 2   // 178mm

  // ── helpers ──────────────────────────────────────────────

  function drawPageBar(): number {
    pdf.setFillColor(...SAGE)
    pdf.rect(0, 0, pageW, 9, 'F')
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(255, 255, 255)
    pdf.text('Cachola OS  -  Ata de Reuniao', mg, 6)
    pdf.text(new Date().toLocaleDateString('pt-BR'), pageW - mg, 6, { align: 'right' })
    pdf.setTextColor(...DARK)
    return 14
  }

  function drawFooter() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalPages = (pdf as any).internal.getNumberOfPages()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cur        = (pdf as any).internal.getCurrentPageInfo().pageNumber
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    pdf.setTextColor(...LIGHT)
    pdf.text('Gerado por Cachola OS', mg, pageH - 6)
    pdf.text(`Pagina ${cur} de ${totalPages}`, pageW - mg, pageH - 6, { align: 'right' })
    pdf.setTextColor(...DARK)
  }

  function drawSection(y: number, label: string): number {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9.5)
    pdf.setTextColor(...SAGE)
    pdf.text(label, mg, y)
    pdf.setDrawColor(...SAGE)
    pdf.setLineWidth(0.35)
    pdf.line(mg, y + 1.5, pageW - mg, y + 1.5)
    pdf.setLineWidth(0.2)
    pdf.setTextColor(...DARK)
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

  // ── PAGE 1 ───────────────────────────────────────────────

  let y = drawPageBar()

  // Document title
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(15)
  pdf.setTextColor(...DARK)
  pdf.text('Ata de Reuniao', mg, y + 7)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(...MID)
  pdf.text(minute.title, mg, y + 14)
  y += 22

  // ── INFORMACOES GERAIS ────────────────────────────────────

  y = drawSection(y, 'INFORMACOES GERAIS')

  const meetingDate = new Date(minute.meeting_date + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const infoRows: [string, string][] = [
    ['Data',     meetingDate],
    ['Status',   MEETING_STATUS_PT[minute.status] ?? minute.status],
    ...(minute.location ? [['Local', minute.location] as [string, string]] : []),
    ...(minute.creator  ? [['Criado por', minute.creator.name] as [string, string]] : []),
    ['Criado em', new Date(minute.created_at).toLocaleDateString('pt-BR')],
  ]

  const iLineH = 6.5
  const boxH   = infoRows.length * iLineH + 8

  pdf.setFillColor(246, 248, 246)
  pdf.setDrawColor(210, 220, 210)
  pdf.setLineWidth(0.2)
  pdf.roundedRect(mg, y, cW, boxH, 2, 2, 'FD')

  let bY = y + 7
  const labelX = mg + 4
  const valueX = mg + 44

  for (const [label, value] of infoRows) {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7.5)
    pdf.setTextColor(...MID)
    pdf.text(label + ':', labelX, bY)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(...DARK)
    pdf.text(value, valueX, bY, { maxWidth: cW - (valueX - mg) - 4 })
    bY += iLineH
  }
  y += boxH + 8

  // ── PARTICIPANTES ─────────────────────────────────────────

  y = checkSpace(y, 20)
  y = drawSection(y, 'PARTICIPANTES')

  if (minute.participants.length === 0) {
    pdf.setFont('helvetica', 'italic')
    pdf.setFontSize(9)
    pdf.setTextColor(...LIGHT)
    pdf.text('Nenhum participante registrado.', mg, y)
    y += 8
  } else {
    for (const p of minute.participants) {
      y = checkSpace(y, 8)
      const name     = p.user?.name ?? 'Usuario removido'
      const roleLabel = PARTICIPANT_ROLE_LABELS[p.role] ?? p.role
      const isAbsent = p.role === 'absent'

      pdf.setFont('helvetica', isAbsent ? 'italic' : 'normal')
      pdf.setFontSize(9)
      pdf.setTextColor(isAbsent ? 140 : DARK[0], isAbsent ? 140 : DARK[1], isAbsent ? 140 : DARK[2])
      pdf.text(`\u2022  ${name}`, mg + 2, y)

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor(...LIGHT)
      pdf.text(`(${roleLabel})`, mg + 2 + pdf.getStringUnitWidth(`\u2022  ${name}`) * 9 / pdf.internal.scaleFactor + 2, y)

      y += 6.5
    }
    y += 2
  }

  // ── RESUMO ────────────────────────────────────────────────

  if (minute.summary) {
    y = checkSpace(y, 20)
    y = drawSection(y, 'RESUMO')

    const lines = pdf.splitTextToSize(minute.summary, cW)
    y = checkSpace(y, lines.length * 5 + 4)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9.5)
    pdf.setTextColor(...DARK)
    pdf.text(lines, mg, y)
    y += lines.length * 5 + 8
  }

  // ── REGISTRO DA REUNIAO ───────────────────────────────────

  if (minute.notes) {
    y = checkSpace(y, 20)
    y = drawSection(y, 'REGISTRO DA REUNIAO')

    const noteLines = pdf.splitTextToSize(minute.notes, cW)
    // If notes are very long, they'll naturally flow across pages via checkSpace per chunk
    const chunkSize = 10
    for (let i = 0; i < noteLines.length; i += chunkSize) {
      const chunk = noteLines.slice(i, i + chunkSize)
      y = checkSpace(y, chunk.length * 5 + 2)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9.5)
      pdf.setTextColor(...DARK)
      pdf.text(chunk, mg, y)
      y += chunk.length * 5
    }
    y += 8
  }

  // ── ITENS DE ACAO ─────────────────────────────────────────

  y = checkSpace(y, 24)
  y = drawSection(y, 'ITENS DE ACAO')

  if (minute.action_items.length === 0) {
    pdf.setFont('helvetica', 'italic')
    pdf.setFontSize(9)
    pdf.setTextColor(...LIGHT)
    pdf.text('Nenhum item de acao registrado.', mg, y)
    y += 8
  } else {
    // Column layout (mm)
    const col = {
      desc:   { x: mg,        w: 88 },
      resp:   { x: mg + 88,   w: 42 },
      due:    { x: mg + 130,  w: 28 },
      status: { x: mg + 158,  w: 20 },
    }

    // Table header
    pdf.setFillColor(...BEIGE)
    pdf.rect(mg, y, cW, 7.5, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7.5)
    pdf.setTextColor(60, 60, 60)
    pdf.text('Descricao',    col.desc.x   + 2, y + 5)
    pdf.text('Responsavel',  col.resp.x   + 2, y + 5)
    pdf.text('Prazo',        col.due.x    + 2, y + 5)
    pdf.text('Status',       col.status.x + 2, y + 5)
    y += 7.5

    minute.action_items.forEach((item, idx) => {
      const descLines = pdf.splitTextToSize(item.description, col.desc.w - 4)
      const rowH      = Math.max(7.5, descLines.length * 4.8 + 2)

      y = checkSpace(y, rowH)

      if (idx % 2 === 0) {
        pdf.setFillColor(249, 247, 245)
        pdf.rect(mg, y, cW, rowH, 'F')
      }

      const isDone = item.status === 'done'

      // Description
      pdf.setFont('helvetica', isDone ? 'italic' : 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor(isDone ? 140 : DARK[0], isDone ? 140 : DARK[1], isDone ? 140 : DARK[2])
      pdf.text(descLines, col.desc.x + 2, y + 4.8)

      // Assignee
      if (item.assignee) {
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(7.5)
        pdf.setTextColor(...MID)
        pdf.text(item.assignee.name.split(' ')[0], col.resp.x + 2, y + 4.8, { maxWidth: col.resp.w - 4 })
      }

      // Due date
      if (item.due_date) {
        const overdue = !isDone && new Date(item.due_date + 'T00:00:00') < new Date(new Date().toDateString())
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(7.5)
        pdf.setTextColor(overdue ? 180 : MID[0], overdue ? 40 : MID[1], overdue ? 40 : MID[2])
        pdf.text(
          new Date(item.due_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          col.due.x + 2,
          y + 4.8,
        )
      }

      // Status badge text
      const statusLabel = ACTION_ITEM_STATUS_LABELS[item.status] ?? item.status
      let sR = LIGHT[0], sG = LIGHT[1], sB = LIGHT[2]
      if (item.status === 'done')        { sR = 34;  sG = 120; sB = 60  }
      if (item.status === 'in_progress') { sR = 180; sG = 100; sB = 20  }

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7)
      pdf.setTextColor(sR, sG, sB)
      pdf.text(statusLabel, col.status.x + 2, y + 4.8)

      // Row separator
      pdf.setDrawColor(230, 228, 225)
      pdf.setLineWidth(0.1)
      pdf.line(mg, y + rowH, mg + cW, y + rowH)

      y += rowH
    })

    // Done count summary
    const doneCount = minute.action_items.filter((a) => a.status === 'done').length
    y = checkSpace(y, 8)
    y += 3
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(...LIGHT)
    pdf.text(
      `${doneCount} de ${minute.action_items.length} ${minute.action_items.length === 1 ? 'item concluido' : 'itens concluidos'}`,
      mg,
      y,
    )
    y += 8
  }

  // ── FINAL FOOTER ──────────────────────────────────────────

  const genLine = `Gerado em ${new Date().toLocaleString('pt-BR')} · cachola.cloud`
  y = checkSpace(y, 16)
  pdf.setDrawColor(220, 218, 215)
  pdf.setLineWidth(0.2)
  pdf.line(mg, y, pageW - mg, y)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7.5)
  pdf.setTextColor(...LIGHT)
  pdf.text(genLine, mg, y + 5)

  drawFooter()

  // ── FILENAME ──────────────────────────────────────────────

  const slug = minute.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)

  const dateStr = new Date().toISOString().slice(0, 10)
  pdf.save(`ata-${slug}-${dateStr}.pdf`)
}
