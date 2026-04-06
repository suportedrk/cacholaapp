import { wrapInLayout } from './base'

interface MaintenanceOverdueData {
  orderTitle: string
  orderId: string
  assignedTo?: string
  daysOverdue?: number
}

export function tplMaintenanceOverdue({ orderTitle, orderId, assignedTo, daysOverdue }: MaintenanceOverdueData) {
  const overdueLine = daysOverdue && daysOverdue > 0
    ? `<p style="margin:0 0 8px;font-size:13px;color:#D97706;font-weight:600;">
        Atrasada há ${daysOverdue} dia${daysOverdue > 1 ? 's' : ''}.
       </p>`
    : ''

  const assignedLine = assignedTo
    ? `<p style="margin:0 0 8px;font-size:13px;color:#6B7280;"><strong>Responsável:</strong> ${assignedTo}</p>`
    : ''

  const body = `
    <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
      A ordem de manutenção <strong>"${orderTitle}"</strong> está com o prazo vencido.
    </p>
    ${overdueLine}
    ${assignedLine}
    <p style="margin:0;font-size:14px;color:#6B7280;">
      Resolva o quanto antes para evitar problemas operacionais.
    </p>`

  return {
    subject: `⚠️ Manutenção Atrasada: ${orderTitle}`,
    html: wrapInLayout(
      'Manutenção Atrasada',
      body,
      `/manutencao/${orderId}`,
      'Ver Ordem de Manutenção',
      `Manutenção atrasada: ${orderTitle}`,
    ),
  }
}
