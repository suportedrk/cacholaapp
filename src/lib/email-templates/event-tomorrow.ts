import { wrapInLayout } from './base'

interface EventTomorrowData {
  eventTitle: string
  eventId: string
  eventDate: string
  startTime?: string
  clientName?: string
}

export function tplEventTomorrow({ eventTitle, eventId, eventDate, startTime, clientName }: EventTomorrowData) {
  const timeLine = startTime
    ? `<p style="margin:0 0 4px;font-size:13px;color:#6B7280;"><strong>Horário:</strong> ${startTime}</p>`
    : ''

  const clientLine = clientName
    ? `<p style="margin:0 0 4px;font-size:13px;color:#6B7280;"><strong>Cliente:</strong> ${clientName}</p>`
    : ''

  const body = `
    <div style="background:#F0FDF4;border-left:4px solid #7C8D78;border-radius:4px;padding:12px 16px;margin-bottom:16px;">
      <p style="margin:0;font-size:13px;font-weight:700;color:#7C8D78;text-transform:uppercase;letter-spacing:0.5px;">
        📅 Lembrete de Evento
      </p>
    </div>
    <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6;">
      O evento <strong>"${eventTitle}"</strong> acontece
      <strong>amanhã, dia ${eventDate}</strong>.
    </p>
    ${timeLine}
    ${clientLine}
    <p style="margin:0;font-size:14px;color:#6B7280;margin-top:8px;">
      Certifique-se de que tudo está preparado para o dia do evento.
    </p>`

  return {
    subject: `📅 Evento amanhã: ${eventTitle}`,
    html: wrapInLayout(
      'Lembrete: Evento Amanhã',
      body,
      `/eventos/${eventId}`,
      'Ver Evento',
      `Lembrete: ${eventTitle} acontece amanhã — ${eventDate}`,
    ),
  }
}
