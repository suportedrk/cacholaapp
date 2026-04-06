import { wrapInLayout } from './base'

interface GenericNotificationData {
  title: string
  message: string
  link?: string
  linkLabel?: string
  preheader?: string
}

export function tplGenericNotification({ title, message, link, linkLabel, preheader }: GenericNotificationData) {
  const body = `
    <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">
      ${message}
    </p>`

  return {
    subject: title,
    html: wrapInLayout(
      title,
      body,
      link,
      linkLabel ?? 'Acessar o Sistema',
      preheader ?? title,
    ),
  }
}
