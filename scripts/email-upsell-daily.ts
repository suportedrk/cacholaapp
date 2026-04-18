#!/usr/bin/env tsx
// =============================================================
// E-mail diário de upsell — 08h BRT (11h UTC)
// Envia um resumo das oportunidades pendentes para cada
// vendedora ativa com pelo menos 1 oportunidade não contatada.
//
// Uso:
//   npx tsx scripts/email-upsell-daily.ts          # envia de verdade
//   npx tsx scripts/email-upsell-daily.ts --dry-run # só imprime, não envia
//   npx tsx scripts/email-upsell-daily.ts --sample  # dumpa HTML de amostra (sem DB/SMTP)
//
// Pré-requisitos:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   SMTP_HOST, SMTP_USER, SMTP_PASS, NEXT_PUBLIC_APP_URL
// =============================================================

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

const DRY_RUN = process.argv.includes('--dry-run')
const SAMPLE  = process.argv.includes('--sample')
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cachola.cloud'

// ── Supabase ──────────────────────────────────────────────────

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !key) throw new Error('SUPABASE env vars missing')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient(url, key, { auth: { persistSession: false } }) as any
}

// ── SMTP ──────────────────────────────────────────────────────

function createTransport() {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) throw new Error('SMTP env vars missing')
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: (Number(process.env.SMTP_PORT) || 465) === 465,
    auth: { user, pass },
  })
}

// ── HTML template ─────────────────────────────────────────────

function buildHtml(
  vendedoraName: string,
  opportunities: Array<{ event_title: string; event_date: string; contact_name: string; missing_categories: string[] }>,
): string {
  const rows = opportunities.map((o) => {
    const date = new Date(o.event_date + 'T00:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit',
    })
    const cats = o.missing_categories.join(', ')
    return `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #EEF0EB;font-size:13px;color:#1A1A1A;">${o.event_title}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #EEF0EB;font-size:13px;color:#555;">${date}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #EEF0EB;font-size:13px;color:#555;">${o.contact_name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #EEF0EB;font-size:13px;color:#7C8D78;font-weight:600;">${cats}</td>
      </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#F5F4F0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F4F0;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
        style="max-width:620px;background:#FFFFFF;border-radius:12px;border:1px solid #E8E6E1;overflow:hidden;">
        <tr><td style="background:#7C8D78;padding:20px 28px;">
          <p style="margin:0;font-size:18px;font-weight:700;color:#FFFFFF;">Cachola OS</p>
        </td></tr>
        <tr><td style="padding:28px 28px 16px;">
          <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1A1A1A;">Oportunidades de Upsell</h1>
          <p style="margin:0 0 20px;font-size:14px;color:#555;">
            Olá, ${vendedoraName}! Você tem <strong>${opportunities.length}</strong>
            oportunidade${opportunities.length !== 1 ? 's' : ''} de upsell nos próximos
            30–40 dias ainda não contatada${opportunities.length !== 1 ? 's' : ''}.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0"
            style="border:1px solid #EEF0EB;border-radius:8px;overflow:hidden;">
            <thead>
              <tr style="background:#F8F7F5;">
                <th style="padding:10px 12px;text-align:left;font-size:12px;color:#9CA3AF;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Evento</th>
                <th style="padding:10px 12px;text-align:left;font-size:12px;color:#9CA3AF;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Data</th>
                <th style="padding:10px 12px;text-align:left;font-size:12px;color:#9CA3AF;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Cliente</th>
                <th style="padding:10px 12px;text-align:left;font-size:12px;color:#9CA3AF;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Falta</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:20px 28px;">
          <a href="${APP_URL}/vendas?tab=upsell"
            style="display:inline-block;background:#7C8D78;color:#ffffff;font-size:14px;
                   font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">
            Ver oportunidades
          </a>
        </td></tr>
        <tr><td style="padding:16px 28px 24px;border-top:1px solid #EEF0EB;">
          <p style="margin:0;font-size:12px;color:#9CA3AF;">
            E-mail automático enviado pelo Cachola OS. Janela: 30–40 dias.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Sample mode (--sample) ────────────────────────────────────

function sampleMain() {
  const sampleOpps = [
    { event_title: 'Festa da Ana Clara',  event_date: '2026-05-20', contact_name: 'Fernanda Souza',  missing_categories: ['Adicionais'] },
    { event_title: 'Aniversário do Pedro', event_date: '2026-05-22', contact_name: 'Mariana Lima',   missing_categories: ['Upgrades'] },
    { event_title: 'Festa da Isabela',    event_date: '2026-05-25', contact_name: 'Juliana Martins', missing_categories: ['Adicionais', 'Upgrades'] },
    { event_title: 'Aniversário do Lucas', event_date: '2026-05-28', contact_name: 'Patricia Costa', missing_categories: ['Adicionais'] },
  ]
  const html = buildHtml('Bruna Jana', sampleOpps)
  console.info('[email-upsell-daily] (SAMPLE) HTML gerado — cole num browser para visualizar:\n')
  console.info('────────────────────────────────────────────────────────────────')
  console.info(html)
  console.info('────────────────────────────────────────────────────────────────')
  console.info(`\n✅ Assunto seria: "4 oportunidades de upsell — Cachola OS"`)
  console.info(`✅ CTA aponta para: ${APP_URL}/vendas?tab=upsell`)
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  console.info(`[email-upsell-daily] ${DRY_RUN ? '(DRY RUN) ' : ''}Início — ${new Date().toISOString()}`)

  const supabase  = sb()
  const transport = DRY_RUN ? null : createTransport()
  const today     = new Date().toISOString().slice(0, 10)

  // Load all active vendedoras with email
  const { data: users, error: userErr } = await supabase
    .from('users')
    .select('id, name, email, seller_id')
    .eq('role', 'vendedora')
    .not('seller_id', 'is', null)
    .not('email', 'is', null)

  if (userErr) { console.error('❌ Erro ao buscar usuários:', userErr.message); process.exit(1) }

  let sent = 0
  let skipped = 0

  for (const user of (users ?? [])) {
    // Check dedup: already sent today?
    const { data: alreadySent } = await supabase
      .from('email_sent_log')
      .select('id')
      .eq('email_type', 'upsell_daily')
      .eq('recipient_user_id', user.id)
      .eq('sent_date', today)
      .limit(1)
      .single()

    if (alreadySent) {
      skipped++
      console.info(`  ⏭  ${user.name} (${user.email}) — já enviado hoje`)
      continue
    }

    // Fetch opportunities for this seller
    const { data: opps, error: oppsErr } = await supabase.rpc('get_upsell_opportunities', {
      p_seller_id:      user.seller_id,
      p_show_contacted: false,
      p_source:         'mine',
    })

    if (oppsErr) {
      console.error(`  ❌ RPC error para ${user.name}:`, oppsErr.message)
      continue
    }

    const myOpps = (opps ?? []) as Array<{
      event_title:        string
      event_date:         string
      contact_name:       string
      missing_categories: string[]
      is_carteira_livre:  boolean
    }>

    if (myOpps.length === 0) {
      console.info(`  ✅ ${user.name} — 0 oportunidades, pulando`)
      continue
    }

    const html = buildHtml(user.name, myOpps)

    if (DRY_RUN) {
      console.info(`  [DRY] Enviaria para ${user.name} <${user.email}> — ${myOpps.length} oportunidades`)
      console.info(`        Assunto: "${myOpps.length} oportunidade${myOpps.length !== 1 ? 's' : ''} de upsell — Cachola OS"`)
      console.info(`        HTML (primeiros 200 chars): ${buildHtml(user.name, myOpps).slice(0, 200)}…`)
    } else {
      try {
        await transport!.sendMail({
          from:    `"Cachola OS" <${process.env.SMTP_USER}>`,
          to:      user.email,
          subject: `${myOpps.length} oportunidade${myOpps.length !== 1 ? 's' : ''} de upsell — Cachola OS`,
          html,
        })

        await supabase.from('email_sent_log').insert({
          email_type:        'upsell_daily',
          recipient_user_id: user.id,
          sent_date:         today,
          metadata:          { count: myOpps.length },
        })

        sent++
        console.info(`  ✅ Enviado para ${user.name} <${user.email}> — ${myOpps.length} oportunidades`)
      } catch (err) {
        console.error(`  ❌ Falha ao enviar para ${user.name}:`, (err as Error).message)
      }
    }
  }

  console.info(`\n── Resultado ─────────────────────────────────────`)
  console.info(`✅ Enviados: ${sent}`)
  console.info(`⏭  Pulados (já enviados/sem opps): ${skipped}`)
  console.info(`✅ Concluído.`)
}

if (SAMPLE) {
  sampleMain()
} else {
  main().catch((err) => {
    console.error('❌ Erro fatal:', err)
    process.exit(1)
  })
}
