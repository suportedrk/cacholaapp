import { wrapInLayout } from './base'

interface MaintenanceEmergencyData {
  orderTitle: string
  orderId: string
  description?: string
  sector?: string
}

export function tplMaintenanceEmergency({ orderTitle, orderId, description, sector }: MaintenanceEmergencyData) {
  const extraRows = [
    sector ? `<tr><td style="padding:4px 0;font-size:13px;color:#6B7280;"><strong>Setor:</strong> ${sector}</td></tr>` : '',
    description ? `<tr><td style="padding:4px 0;font-size:13px;color:#6B7280;"><strong>Descrição:</strong> ${description}</td></tr>` : '',
  ].filter(Boolean).join('')

  const body = `
    <div style="background:#FEF2F2;border-left:4px solid #DC2626;border-radius:4px;padding:12px 16px;margin-bottom:16px;">
      <p style="margin:0;font-size:13px;font-weight:700;color:#DC2626;text-transform:uppercase;letter-spacing:0.5px;">
        ⚠ Atenção Imediata Necessária
      </p>
    </div>
    <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6;">
      A ordem de manutenção <strong>"${orderTitle}"</strong> foi criada como
      <strong style="color:#DC2626;">emergência</strong> e requer resolução imediata.
    </p>
    ${extraRows ? `<table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">${extraRows}</table>` : ''}
    <p style="margin:0;font-size:14px;color:#6B7280;">
      Acesse o sistema para verificar os detalhes e tomar as providências necessárias.
    </p>`

  return {
    subject: `🔴 Manutenção Emergencial: ${orderTitle}`,
    html: wrapInLayout(
      '🔴 Manutenção Emergencial',
      body,
      `/manutencao/${orderId}`,
      'Ver Ordem de Manutenção',
      `Emergência: ${orderTitle} — ação imediata necessária`,
    ),
  }
}
