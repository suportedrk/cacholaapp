/**
 * Envio de e-mail via nodemailer + SMTP (Hostinger).
 * Server-side only — nunca importar em componentes client.
 * Sempre fire-and-forget: erros são logados, nunca sobem para o chamador.
 */

import nodemailer, { type Transporter } from 'nodemailer'

// ─────────────────────────────────────────────────────────────
// TRANSPORTER — singleton, criado sob demanda
// ─────────────────────────────────────────────────────────────
let _transporter: Transporter | null = null

function getTransporter(): Transporter | null {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[email] SMTP_HOST / SMTP_USER / SMTP_PASS não configurados — envio de e-mail desabilitado')
    return null
  }

  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 465,
      secure: (Number(process.env.SMTP_PORT) || 465) === 465, // SSL implícito para 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  }

  return _transporter
}

const SENDER_NAME = process.env.SMTP_SENDER_NAME ?? 'Cachola OS'
const FROM = `"${SENDER_NAME}" <${process.env.SMTP_USER ?? 'noreply@cachola.cloud'}>`

// ─────────────────────────────────────────────────────────────
// RE-EXPORTS DOS TEMPLATES (retrocompatibilidade com consumidores)
// ─────────────────────────────────────────────────────────────
export { tplMaintenanceEmergency } from './email-templates/maintenance-emergency'
export { tplMaintenanceOverdue } from './email-templates/maintenance-overdue'
export { tplEventTomorrow } from './email-templates/event-tomorrow'
export { tplChecklistOverdue } from './email-templates/checklist-overdue'
export { tplGenericNotification } from './email-templates/generic-notification'

// ─────────────────────────────────────────────────────────────
// SEND — graceful fallback (nunca lança exceção)
// ─────────────────────────────────────────────────────────────
export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string,
): Promise<void> {
  const transporter = getTransporter()
  if (!transporter) return

  try {
    await transporter.sendMail({
      from: FROM,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
      text: html.replace(/<[^>]*>/g, '').replace(/\s{2,}/g, ' ').trim(),
    })
  } catch (err) {
    console.error('[email] Falha ao enviar e-mail:', err)
  }
}
