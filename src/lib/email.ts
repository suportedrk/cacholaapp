/**
 * Email sending via Resend.
 * Server-side only — never import in client components.
 * Always fire-and-forget: errors are logged but never bubble up.
 */

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.EMAIL_FROM ?? 'Cachola OS <no-reply@cacholaos.com.br>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// ─────────────────────────────────────────────────────────────
// BASE TEMPLATE
// ─────────────────────────────────────────────────────────────
function baseTemplate(title: string, body: string, ctaUrl?: string, ctaLabel?: string): string {
  const cta = ctaUrl && ctaLabel
    ? `
      <tr>
        <td align="center" style="padding: 24px 0 8px;">
          <a href="${APP_URL}${ctaUrl}"
            style="display:inline-block;background:#7C8D78;color:#ffffff;font-size:14px;
                   font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">
            ${ctaLabel}
          </a>
        </td>
      </tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F5F4F0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F4F0;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0"
          style="max-width:560px;background:#FFFFFF;border-radius:12px;
                 border:1px solid #E8E6E1;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#7C8D78;padding:20px 28px;">
              <p style="margin:0;font-size:18px;font-weight:700;color:#FFFFFF;letter-spacing:-0.3px;">
                Cachola OS
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 28px 8px;">
              <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#1A1A1A;line-height:1.3;">
                ${title}
              </h1>
              ${body}
            </td>
          </tr>

          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0">
            ${cta}
          </table>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 28px 24px;border-top:1px solid #EEF0EB;margin-top:8px;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.5;">
                Este e-mail foi enviado automaticamente pelo sistema Cachola OS.<br/>
                Se você não esperava esta mensagem, pode ignorá-la com segurança.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ─────────────────────────────────────────────────────────────
// TEMPLATES
// ─────────────────────────────────────────────────────────────
export function tplMaintenanceEmergency(orderTitle: string, orderId: string) {
  return {
    subject: `🔴 Manutenção Emergencial: ${orderTitle}`,
    html: baseTemplate(
      '🔴 Manutenção Emergencial',
      `<p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
        A ordem de manutenção <strong>"${orderTitle}"</strong> foi criada como
        <strong style="color:#DC2626;">emergência</strong> e requer atenção imediata.
      </p>
      <p style="margin:0;font-size:14px;color:#6B7280;">
        Acesse o sistema para verificar os detalhes e tomar as providências necessárias.
      </p>`,
      `/manutencao/${orderId}`,
      'Ver Ordem de Manutenção'
    ),
  }
}

export function tplMaintenanceOverdue(orderTitle: string, orderId: string) {
  return {
    subject: `⚠️ Manutenção Atrasada: ${orderTitle}`,
    html: baseTemplate(
      'Manutenção Atrasada',
      `<p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
        A ordem de manutenção <strong>"${orderTitle}"</strong> está com o prazo vencido.
      </p>
      <p style="margin:0;font-size:14px;color:#6B7280;">
        Resolva o quanto antes para evitar problemas operacionais.
      </p>`,
      `/manutencao/${orderId}`,
      'Ver Ordem de Manutenção'
    ),
  }
}

export function tplEventTomorrow(eventTitle: string, eventId: string, eventDate: string) {
  return {
    subject: `📅 Evento amanhã: ${eventTitle}`,
    html: baseTemplate(
      'Lembrete: Evento Amanhã',
      `<p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
        O evento <strong>"${eventTitle}"</strong> acontece
        <strong>amanhã, dia ${eventDate}</strong>.
      </p>
      <p style="margin:0;font-size:14px;color:#6B7280;">
        Certifique-se de que tudo está preparado para o dia do evento.
      </p>`,
      `/eventos/${eventId}`,
      'Ver Evento'
    ),
  }
}

export function tplChecklistOverdue(checklistTitle: string, checklistId: string) {
  return {
    subject: `📋 Checklist Atrasado: ${checklistTitle}`,
    html: baseTemplate(
      'Checklist Atrasado',
      `<p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
        O checklist <strong>"${checklistTitle}"</strong> está com o prazo vencido.
      </p>
      <p style="margin:0;font-size:14px;color:#6B7280;">
        Finalize o checklist o quanto antes para manter o controle das operações.
      </p>`,
      `/checklists/${checklistId}`,
      'Ver Checklist'
    ),
  }
}

// ─────────────────────────────────────────────────────────────
// SEND — graceful fallback (never throws)
// ─────────────────────────────────────────────────────────────
export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping email send')
    return
  }
  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject, html })
    if (error) console.error('[email] Resend error:', error)
  } catch (err) {
    console.error('[email] Failed to send email:', err)
  }
}
