import { createClient } from '@supabase/supabase-js'
import { sendEmail, tplBackupFailure } from '@/lib/email'
import type { BackupFailureRow } from '@/lib/email-templates/backup-failure'

/**
 * GET /api/cron/backup-check
 *
 * Monitora a tabela backup_log e envia alerta por e-mail se detectar:
 *  1. Falha explícita  — status='failed' desde meia-noite de hoje
 *  2. Travado          — status='in_progress' há mais de 2h
 *  3. Backup ausente   — nenhum registro kind='daily' desde meia-noite
 *                        (só verificado após 04:00, pois backup roda às 03:00)
 *
 * Dedup via email_sent_log: no máximo 1 alerta por dia.
 * O recipient_user_id é resolvido pelo e-mail configurado em BACKUP_ALERT_EMAIL.
 *
 * Protegido por CRON_SECRET no header Authorization.
 */
export async function GET(request: Request) {
  // ── Verificação de segurança ──
  const authHeader = request.headers.get('authorization')
  const expectedToken = process.env.CRON_SECRET

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const recipientEmail = process.env.BACKUP_ALERT_EMAIL ?? 'bruno.casaletti@grupodrk.com.br'

  // ── Cliente admin (bypassa RLS) ──
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // ── Janela de tempo ──
  const now = new Date()
  const midnightToday = new Date(now)
  midnightToday.setHours(0, 0, 0, 0)
  const midnightISO = midnightToday.toISOString()
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()
  const todayStr = now.toISOString().split('T')[0]

  // ── Condição 3: backup diário rodou hoje? (checar só após 04:00 local) ──
  const hourNow = now.getHours()
  let backupMissing = false

  if (hourNow >= 4) {
    const { data: dailyToday } = await (supabase
      .from('backup_log' as never)
      .select('id')
      .eq('kind', 'daily')
      .gte('started_at', midnightISO)
      .limit(1) as unknown as Promise<{ data: { id: string }[] | null }>)

    backupMissing = (dailyToday?.length ?? 0) === 0
  }

  // ── Condição 1: falhas explícitas de hoje ──
  const { data: failedRows } = await (supabase
    .from('backup_log' as never)
    .select('kind, source, filename, status, started_at, error_message')
    .eq('status', 'failed')
    .gte('started_at', midnightISO)
    .order('started_at', { ascending: false }) as unknown as Promise<{
      data: BackupFailureRow[] | null
    }>)

  // ── Condição 2: travados (in_progress há > 2h) ──
  const { data: stuckRows } = await (supabase
    .from('backup_log' as never)
    .select('kind, source, filename, status, started_at, error_message')
    .eq('status', 'in_progress')
    .lte('started_at', twoHoursAgo)
    .order('started_at', { ascending: false }) as unknown as Promise<{
      data: BackupFailureRow[] | null
    }>)

  const failures = failedRows ?? []
  const stuck = stuckRows ?? []
  const hasProblems = failures.length > 0 || stuck.length > 0 || backupMissing

  if (!hasProblems) {
    return Response.json({ ok: true, message: 'Todos os backups estão saudáveis.' })
  }

  // ── Resolver user_id do destinatário para dedup ──
  const { data: recipientUser } = await (supabase
    .from('users' as never)
    .select('id')
    .eq('email', recipientEmail)
    .single() as unknown as Promise<{ data: { id: string } | null }>)

  // ── Dedup: já enviamos alerta hoje? ──
  if (recipientUser?.id) {
    const { data: dedupRow } = await (supabase
      .from('email_sent_log' as never)
      .select('id')
      .eq('email_type', 'backup_failure_alert')
      .eq('recipient_user_id', recipientUser.id)
      .eq('sent_date', todayStr)
      .limit(1) as unknown as Promise<{ data: { id: string }[] | null }>)

    if ((dedupRow?.length ?? 0) > 0) {
      return Response.json({
        ok: true,
        message: 'Alerta já enviado hoje — dedup ativo.',
        problems: { failures: failures.length, stuck: stuck.length, backupMissing },
      })
    }
  }

  // ── Enviar e-mail ──
  const { subject, html } = tplBackupFailure({ failures, stuckRows: stuck, backupMissing })
  await sendEmail(recipientEmail, subject, html)

  // ── Registrar no email_sent_log (se user_id conhecido) ──
  if (recipientUser?.id) {
    await (supabase
      .from('email_sent_log' as never)
      .insert({
        email_type: 'backup_failure_alert',
        recipient_user_id: recipientUser.id,
        sent_date: todayStr,
      } as never) as unknown as Promise<unknown>)
  }

  return Response.json({
    ok: true,
    alerted: true,
    recipient: recipientEmail,
    problems: { failures: failures.length, stuck: stuck.length, backupMissing },
  })
}
