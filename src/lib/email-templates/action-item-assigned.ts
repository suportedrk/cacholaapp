import { wrapInLayout, escapeHtml } from './base'

interface AssignedTask {
  description: string
  dueLabel:    string | null   // prazo já formatado em pt-BR, ou null quando sem prazo
}

interface ActionItemAssignedData {
  assigneeName: string
  assignerName: string
  meetingTitle: string
  meetingDate:  string         // já formatado em pt-BR
  tasks:        AssignedTask[]
}

export function tplActionItemAssigned({
  assigneeName,
  assignerName,
  meetingTitle,
  meetingDate,
  tasks,
}: ActionItemAssignedData) {
  const isPlural = tasks.length !== 1

  const taskRows = tasks
    .map(
      (t) => `
        <tr>
          <td style="padding:8px 0 4px;border-top:1px solid #DDD8D2;font-size:13px;color:#374151;line-height:1.5;">
            <strong style="color:#1A1A1A;">✅ ${escapeHtml(t.description)}</strong>
            ${
              t.dueLabel
                ? `<br /><span style="font-size:12px;color:#777777;">📅 Prazo: ${escapeHtml(t.dueLabel)}</span>`
                : `<br /><span style="font-size:12px;color:#9CA3AF;">Sem prazo definido</span>`
            }
          </td>
        </tr>`,
    )
    .join('')

  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Olá <strong>${escapeHtml(assigneeName)}</strong>,
    </p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      <strong>${escapeHtml(assignerName)}</strong> atribuiu ${isPlural ? 'novas tarefas' : 'uma nova tarefa'} a você
      na ata de reunião <strong>"${escapeHtml(meetingTitle)}"</strong> (${meetingDate}).
    </p>

    <!-- Tasks card -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background:#F0EDE8;border-radius:8px;margin-bottom:24px;">
      <tr>
        <td style="padding:16px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:4px 0;font-size:14px;font-weight:700;color:#1A1A1A;line-height:1.4;">
                📋&nbsp; ${isPlural ? `${tasks.length} tarefas atribuídas a você` : 'Tarefa atribuída a você'}
              </td>
            </tr>
            ${taskRows}
          </table>
        </td>
      </tr>
    </table>`

  return {
    subject: isPlural
      ? `✅ Novas tarefas atribuídas a você — ${meetingTitle}`
      : `✅ Nova tarefa atribuída a você — ${meetingTitle}`,
    html: wrapInLayout(
      isPlural ? 'Novas tarefas atribuídas a você' : 'Nova tarefa atribuída a você',
      body,
      '/atas/minhas-tarefas',
      'Ver Minhas Tarefas',
      `${assignerName} atribuiu ${isPlural ? 'tarefas' : 'uma tarefa'} a você na ata "${meetingTitle}".`,
    ),
  }
}
