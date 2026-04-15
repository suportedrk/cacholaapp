import { wrapInLayout } from './base'

interface MeetingMinuteNotificationData {
  participantName:  string
  creatorName:      string
  title:            string
  meetingDate:      string   // já formatado em pt-BR
  location:         string | null
  participantCount: number
  actionItemCount:  number
  minuteId:         string
}

export function tplMeetingMinuteNotification({
  participantName,
  creatorName,
  title,
  meetingDate,
  location,
  participantCount,
  actionItemCount,
  minuteId,
}: MeetingMinuteNotificationData) {
  const locationRow = location
    ? `<tr>
        <td style="padding:4px 0;font-size:13px;color:#555555;">
          <strong style="color:#333333;">📍 Local:</strong>&nbsp; ${location}
        </td>
       </tr>`
    : ''

  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Olá <strong>${participantName}</strong>,
    </p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      <strong>${creatorName}</strong> publicou uma nova ata de reunião
      na qual você participou.
    </p>

    <!-- Summary card -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background:#F0EDE8;border-radius:8px;margin-bottom:24px;">
      <tr>
        <td style="padding:16px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:4px 0;font-size:14px;font-weight:700;color:#1A1A1A;line-height:1.4;">
                📋&nbsp; ${title}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0 4px;border-top:1px solid #DDD8D2;font-size:13px;color:#555555;">
                <strong style="color:#333333;">📅 Data:</strong>&nbsp; ${meetingDate}
              </td>
            </tr>
            ${locationRow}
            <tr>
              <td style="padding:4px 0;font-size:13px;color:#555555;">
                <strong style="color:#333333;">👥 Participantes:</strong>&nbsp; ${participantCount}
              </td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-size:13px;color:#555555;">
                <strong style="color:#333333;">✅ Itens de ação:</strong>&nbsp; ${actionItemCount}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`

  return {
    subject: `📋 Nova ata publicada: ${title}`,
    html: wrapInLayout(
      'Nova ata de reunião disponível',
      body,
      `/atas/${minuteId}`,
      'Ver Ata Completa',
      `${creatorName} publicou a ata "${title}" — clique para ver os detalhes.`,
    ),
  }
}
