/**
 * Utilitários de exportação — Excel (xlsx) e PDF (jsPDF + html2canvas)
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
