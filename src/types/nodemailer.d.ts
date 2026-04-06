/**
 * Minimal type declarations for nodemailer v6.
 * Cobre apenas a API utilizada no projeto.
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

  export { createTransport, TransportOptions, MailOptions, SentMessageInfo, Transporter }
  export default { createTransport }
}
