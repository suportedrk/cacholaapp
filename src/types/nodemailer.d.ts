/**
 * Minimal type declarations for nodemailer v9.
 * Cobre apenas a API estrutural usada no projeto (createTransport + sendMail +
 * verify/close + host/port/secure/auth/from/to/subject/html/text). Como é só a
 * forma usada, vale para a v9 sem ajuste. Sombreia o pacote — por isso não
 * dependemos de @types/nodemailer.
 */
declare module 'nodemailer' {
  interface TransportOptions {
    host?: string
    port?: number
    secure?: boolean
    auth?: {
      user?: string
      pass?: string
    }
    tls?: Record<string, unknown>
    [key: string]: unknown
  }

  interface MailOptions {
    from?: string
    to?: string | string[]
    cc?: string | string[]
    bcc?: string | string[]
    subject?: string
    html?: string
    text?: string
    replyTo?: string
    [key: string]: unknown
  }

  interface SentMessageInfo {
    messageId: string
    accepted: string[]
    rejected: string[]
    response: string
    [key: string]: unknown
  }

  interface Transporter {
    sendMail(mailOptions: MailOptions): Promise<SentMessageInfo>
    verify(): Promise<true>
    close(): void
  }

  function createTransport(options: TransportOptions): Transporter

  const nodemailer: { createTransport: typeof createTransport }
  export { createTransport, TransportOptions, MailOptions, SentMessageInfo, Transporter }
  export default nodemailer
}
