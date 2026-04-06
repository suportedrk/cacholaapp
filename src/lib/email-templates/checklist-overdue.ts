import { wrapInLayout } from './base'

interface ChecklistOverdueData {
  checklistTitle: string
  checklistId: string
  eventTitle?: string
  pendingItems?: number
}

export function tplChecklistOverdue({ checklistTitle, checklistId, eventTitle, pendingItems }: ChecklistOverdueData) {
  const eventLine = eventTitle
    ? `<p style="margin:0 0 4px;font-size:13px;color:#6B7280;"><strong>Evento vinculado:</strong> ${eventTitle}</p>`
    : ''

  const pendingLine = pendingItems && pendingItems > 0
    ? `<p style="margin:0 0 4px;font-size:13px;color:#D97706;font-weight:600;">
        ${pendingItems} item${pendingItems > 1 ? 's' : ''} pendente${pendingItems > 1 ? 's' : ''}.
       </p>`
    : ''

  const body = `
    <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6;">
      O checklist <strong>"${checklistTitle}"</strong> está com o prazo vencido.
    </p>
    ${eventLine}
    ${pendingLine}
    <p style="margin:0;font-size:14px;color:#6B7280;margin-top:8px;">
      Finalize o checklist o quanto antes para manter o controle das operações.
    </p>`

  return {
    subject: `📋 Checklist Atrasado: ${checklistTitle}`,
    html: wrapInLayout(
      'Checklist Atrasado',
      body,
      `/checklists/${checklistId}`,
      'Ver Checklist',
      `Checklist atrasado: ${checklistTitle}`,
    ),
  }
}
