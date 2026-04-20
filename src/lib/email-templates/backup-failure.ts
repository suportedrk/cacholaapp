import { wrapInLayout } from './base'

export interface BackupFailureRow {
  kind: 'daily' | 'weekly' | 'monthly'
  source: 'local' | 'r2_upload'
  filename: string
  status: 'failed' | 'in_progress'
  started_at: string
  error_message: string | null
}

export interface BackupFailureData {
  failures: BackupFailureRow[]
  stuckRows: BackupFailureRow[]
  backupMissing: boolean
}

function statusLabel(row: BackupFailureRow): string {
  if (row.status === 'failed') return '❌ Falhou'
  return '⏳ Travado'
}

function kindLabel(kind: BackupFailureRow['kind']): string {
  if (kind === 'daily') return 'Diário'
  if (kind === 'weekly') return 'Semanal'
  return 'Mensal'
}

function sourceLabel(source: BackupFailureRow['source']): string {
  return source === 'r2_upload' ? 'R2 Upload' : 'Local'
}

function formatDateBR(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false })
}

export function tplBackupFailure({ failures, stuckRows, backupMissing }: BackupFailureData) {
  const allIssues = [...failures, ...stuckRows]
  const totalIssues = allIssues.length + (backupMissing ? 1 : 0)

  const alertBanner = `
    <div style="background:#FEF2F2;border-left:4px solid #DC2626;border-radius:4px;padding:12px 16px;margin-bottom:16px;">
      <p style="margin:0;font-size:13px;font-weight:700;color:#DC2626;text-transform:uppercase;letter-spacing:0.5px;">
        ⚠ ${totalIssues} problema${totalIssues !== 1 ? 's' : ''} detectado${totalIssues !== 1 ? 's' : ''}
      </p>
    </div>`

  const missingBanner = backupMissing
    ? `<div style="background:#FFFBEB;border-left:4px solid #D97706;border-radius:4px;padding:12px 16px;margin-bottom:16px;">
        <p style="margin:0;font-size:13px;font-weight:600;color:#92400E;">
          🚨 Backup diário não rodou hoje — nenhum registro encontrado desde meia-noite.
        </p>
      </div>`
    : ''

  const tableRows = allIssues.map((row) => `
    <tr>
      <td style="padding:8px 10px;font-size:12px;color:#374151;border-bottom:1px solid #F3F4F6;">
        ${statusLabel(row)}
      </td>
      <td style="padding:8px 10px;font-size:12px;color:#374151;border-bottom:1px solid #F3F4F6;">
        ${kindLabel(row.kind)} / ${sourceLabel(row.source)}
      </td>
      <td style="padding:8px 10px;font-size:12px;font-family:monospace;color:#6B7280;border-bottom:1px solid #F3F4F6;word-break:break-all;">
        ${row.filename}
      </td>
      <td style="padding:8px 10px;font-size:12px;color:#6B7280;border-bottom:1px solid #F3F4F6;white-space:nowrap;">
        ${formatDateBR(row.started_at)}
      </td>
      ${row.error_message
        ? `<td style="padding:8px 10px;font-size:11px;color:#DC2626;border-bottom:1px solid #F3F4F6;">${row.error_message.slice(0, 120)}</td>`
        : `<td style="padding:8px 10px;font-size:11px;color:#9CA3AF;border-bottom:1px solid #F3F4F6;">—</td>`
      }
    </tr>`).join('')

  const tableHtml = allIssues.length > 0
    ? `<div style="overflow-x:auto;margin-bottom:16px;">
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;border-radius:6px;overflow:hidden;">
          <thead>
            <tr style="background:#F9FAFB;">
              <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6B7280;font-weight:600;border-bottom:1px solid #E5E7EB;">Status</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6B7280;font-weight:600;border-bottom:1px solid #E5E7EB;">Tipo</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6B7280;font-weight:600;border-bottom:1px solid #E5E7EB;">Arquivo</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6B7280;font-weight:600;border-bottom:1px solid #E5E7EB;">Iniciado</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6B7280;font-weight:600;border-bottom:1px solid #E5E7EB;">Erro</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>`
    : ''

  const body = `
    ${alertBanner}
    ${missingBanner}
    <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6;">
      O monitoramento automático de backups detectou problemas que requerem sua atenção.
    </p>
    ${tableHtml}
    <p style="margin:0 0 4px;font-size:13px;color:#6B7280;">
      Acesse a página de Backups no painel para ver o histórico completo e diagnóstico.
    </p>`

  return {
    subject: `🔴 Alerta de Backup — ${totalIssues} problema${totalIssues !== 1 ? 's' : ''} detectado${totalIssues !== 1 ? 's' : ''}`,
    html: wrapInLayout(
      '🔴 Alerta de Backup',
      body,
      '/admin/backups',
      'Ver Painel de Backups',
      `${totalIssues} problema${totalIssues !== 1 ? 's' : ''} nos backups — ação recomendada`,
    ),
  }
}
