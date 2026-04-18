#!/usr/bin/env tsx
// =============================================================
// E-mail diário de vendas — 08h BRT (11h UTC)
// Combina oportunidades de Upsell + Recompra por vendedora.
//
// Uso:
//   npx tsx scripts/email-vendas-daily.ts          # envia de verdade
//   npx tsx scripts/email-vendas-daily.ts --dry-run # só imprime, não envia
//   npx tsx scripts/email-vendas-daily.ts --sample  # dumpa HTML de amostra (sem DB/SMTP)
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

// ── Types ─────────────────────────────────────────────────────

interface UpsellOpp {
  event_title:        string
  event_date:         string
  contact_name:       string
  missing_categories: string[]
}

interface RecompraAnivOpp {
  contact_name:        string
  next_birthday:       string
  days_until_birthday: number
  deal_title:          string | null
}

interface RecompraFestaOpp {
  contact_name:       string
  months_since_event: number
  last_event_date:    string
}

// ── HTML template ─────────────────────────────────────────────

function buildHtml(
  vendedoraName: string,
  upsellOpps:   UpsellOpp[],
  anivOpps:     RecompraAnivOpp[],
  festaOpps:    RecompraFestaOpp[],
): string {
  const hasUpsell = upsellOpps.length > 0
  const hasAniv   = anivOpps.length > 0
  const hasFesta  = festaOpps.length > 0

  const total = upsellOpps.length + anivOpps.length + festaOpps.length

  // ── Upsell rows
  const upsellRows = upsellOpps.map((o) => {
    const date = new Date(o.event_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    return `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #EEF0EB;font-size:13px;color:#1A1A1A;">${o.event_title}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #EEF0EB;font-size:13px;color:#555;">${date}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #EEF0EB;font-size:13px;color:#555;">${o.contact_name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #EEF0EB;font-size:13px;color:#7C8D78;font-weight:600;">${o.missing_categories.join(', ')}</td>
      </tr>`
  }).join('')

  // ── Recompra aniversário rows
  const anivRows = anivOpps.map((o) => {
    const bday  = new Date(o.next_birthday + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    const urgency = o.days_until_birthday === 0 ? '🔥 HOJE'
                  : o.days_until_birthday === 1 ? '🔥 Amanhã'
                  : o.days_until_birthday <= 7   ? `🔥 Em ${o.days_until_birthday}d`
                  : o.days_until_birthday <= 30  ? `⚡ Em ${o.days_until_birthday}d`
                  : o.days_until_birthday <= 60  ? `🎂 Em ${o.days_until_birthday}d`
                  : `📅 Em ${o.days_until_birthday}d`
    return `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #EEF0EB;font-size:13px;color:#1A1A1A;">${o.contact_name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #EEF0EB;font-size:13px;color:#555;">${bday}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #EEF0EB;font-size:13px;font-weight:600;color:#DC2626;">${urgency}</td>
      </tr>`
  }).join('')

  // ── Recompra festa passada rows
  const festaRows = festaOpps.map((o) => {
    const last = new Date(o.last_event_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    return `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #EEF0EB;font-size:13px;color:#1A1A1A;">${o.contact_name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #EEF0EB;font-size:13px;color:#555;">${last}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #EEF0EB;font-size:13px;color:#7C8D78;font-weight:600;">Há ${o.months_since_event} meses</td>
      </tr>`
  }).join('')

  const upsellSection = hasUpsell ? `
    <tr><td style="padding:20px 28px 0;">
      <h2 style="margin:0 0 12px;font-size:16px;font-weight:700;color:#1A1A1A;">
        🛍️ Upsell — ${upsellOpps.length} oportunidade${upsellOpps.length !== 1 ? 's' : ''}
      </h2>
      <p style="margin:0 0 12px;font-size:13px;color:#555;">Eventos em 30–40 dias sem Adicional ou Upgrade.</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
        style="border:1px solid #EEF0EB;border-radius:8px;overflow:hidden;">
        <thead><tr style="background:#F8F7F5;">
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:#9CA3AF;font-weight:600;text-transform:uppercase;">Evento</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:#9CA3AF;font-weight:600;text-transform:uppercase;">Data</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:#9CA3AF;font-weight:600;text-transform:uppercase;">Cliente</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:#9CA3AF;font-weight:600;text-transform:uppercase;">Falta</th>
        </tr></thead>
        <tbody>${upsellRows}</tbody>
      </table>
    </td></tr>` : ''

  const anivSection = hasAniv ? `
    <tr><td style="padding:20px 28px 0;">
      <h2 style="margin:0 0 12px;font-size:16px;font-weight:700;color:#1A1A1A;">
        🎂 Recompra — Aniversários próximos (${anivOpps.length})
      </h2>
      <p style="margin:0 0 12px;font-size:13px;color:#555;">Clientes com aniversário do filho nos próximos 90 dias.</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
        style="border:1px solid #EEF0EB;border-radius:8px;overflow:hidden;">
        <thead><tr style="background:#F8F7F5;">
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:#9CA3AF;font-weight:600;text-transform:uppercase;">Cliente</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:#9CA3AF;font-weight:600;text-transform:uppercase;">Aniversário</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:#9CA3AF;font-weight:600;text-transform:uppercase;">Urgência</th>
        </tr></thead>
        <tbody>${anivRows}</tbody>
      </table>
    </td></tr>` : ''

  const festaSection = hasFesta ? `
    <tr><td style="padding:20px 28px 0;">
      <h2 style="margin:0 0 12px;font-size:16px;font-weight:700;color:#1A1A1A;">
        🎉 Recompra — Festas passadas (${festaOpps.length})
      </h2>
      <p style="margin:0 0 12px;font-size:13px;color:#555;">Clientes sem atividade há mais de 10 meses — prontos para reconquistar.</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
        style="border:1px solid #EEF0EB;border-radius:8px;overflow:hidden;">
        <thead><tr style="background:#F8F7F5;">
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:#9CA3AF;font-weight:600;text-transform:uppercase;">Cliente</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:#9CA3AF;font-weight:600;text-transform:uppercase;">Última festa</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:#9CA3AF;font-weight:600;text-transform:uppercase;">Tempo</th>
        </tr></thead>
        <tbody>${festaRows}</tbody>
      </table>
    </td></tr>` : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#F5F4F0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F4F0;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
        style="max-width:640px;background:#FFFFFF;border-radius:12px;border:1px solid #E8E6E1;overflow:hidden;">
        <tr><td style="background:#7C8D78;padding:20px 28px;">
          <p style="margin:0;font-size:18px;font-weight:700;color:#FFFFFF;">Cachola OS</p>
        </tr></td>
        <tr><td style="padding:28px 28px 8px;">
          <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1A1A1A;">Oportunidades de Vendas</h1>
          <p style="margin:0;font-size:14px;color:#555;">
            Olá, ${vendedoraName}! Você tem <strong>${total}</strong>
            oportunidade${total !== 1 ? 's' : ''} hoje: ${upsellOpps.length} upsell,
            ${anivOpps.length} aniversário${anivOpps.length !== 1 ? 's' : ''} próximo${anivOpps.length !== 1 ? 's' : ''},
            ${festaOpps.length} festa${festaOpps.length !== 1 ? 's' : ''} passada${festaOpps.length !== 1 ? 's' : ''}.
          </p>
        </td></tr>

        ${upsellSection}
        ${anivSection}
        ${festaSection}

        <tr><td align="center" style="padding:24px 28px;">
          <a href="${APP_URL}/vendas"
            style="display:inline-block;background:#7C8D78;color:#ffffff;font-size:14px;
                   font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">
            Ver todas as oportunidades
          </a>
        </td></tr>
        <tr><td style="padding:16px 28px 24px;border-top:1px solid #EEF0EB;">
          <p style="margin:0;font-size:12px;color:#9CA3AF;">
            E-mail automático enviado pelo Cachola OS.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Sample mode ───────────────────────────────────────────────

function sampleMain() {
  const sampleUpsell: UpsellOpp[] = [
    { event_title: 'Festa da Ana Clara',   event_date: '2026-05-20', contact_name: 'Fernanda Souza',  missing_categories: ['Adicionais'] },
    { event_title: 'Aniversário do Pedro', event_date: '2026-05-22', contact_name: 'Mariana Lima',    missing_categories: ['Upgrades'] },
  ]
  const sampleAniv: RecompraAnivOpp[] = [
    { contact_name: 'Cristiane Sakumoto', next_birthday: '2026-04-18', days_until_birthday: 0, deal_title: 'Festa Isabela 4 anos' },
    { contact_name: 'Laura Kolberg',      next_birthday: '2026-04-19', days_until_birthday: 1, deal_title: 'Festa Laura 2 anos' },
    { contact_name: 'Marina Oliveira',    next_birthday: '2026-05-15', days_until_birthday: 27, deal_title: 'Festa Pedro 5 anos' },
    { contact_name: 'Patrícia Rocha',     next_birthday: '2026-06-10', days_until_birthday: 53, deal_title: 'Festa Sofia 3 anos' },
  ]
  const sampleFesta: RecompraFestaOpp[] = [
    { contact_name: 'Andreia Costa',  months_since_event: 14, last_event_date: '2025-02-10' },
    { contact_name: 'Renata Pereira', months_since_event: 12, last_event_date: '2025-04-18' },
  ]
  const html = buildHtml('Bruna Jana', sampleUpsell, sampleAniv, sampleFesta)
  console.info('[email-vendas-daily] (SAMPLE) HTML gerado — cole num browser para visualizar:\n')
  console.info('────────────────────────────────────────────────────────────────')
  console.info(html)
  console.info('────────────────────────────────────────────────────────────────')
  const total = sampleUpsell.length + sampleAniv.length + sampleFesta.length
  console.info(`\n✅ Assunto seria: "${total} oportunidades de vendas — Cachola OS"`)
  console.info(`✅ CTA aponta para: ${APP_URL}/vendas`)
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  console.info(`[email-vendas-daily] ${DRY_RUN ? '(DRY RUN) ' : ''}Início — ${new Date().toISOString()}`)

  const supabase  = sb()
  const transport = DRY_RUN ? null : createTransport()
  const today     = new Date().toISOString().slice(0, 10)

  const { data: users, error: userErr } = await supabase
    .from('users')
    .select('id, name, email, seller_id')
    .eq('role', 'vendedora')
    .not('seller_id', 'is', null)
    .not('email', 'is', null)

  if (userErr) { console.error('❌ Erro ao buscar usuários:', userErr.message); process.exit(1) }

  let sent = 0; let skipped = 0

  for (const user of (users ?? [])) {
    // Dedup check
    const { data: alreadySent } = await supabase
      .from('email_sent_log')
      .select('id')
      .eq('email_type', 'vendas_daily')
      .eq('recipient_user_id', user.id)
      .eq('sent_date', today)
      .limit(1)
      .single()

    if (alreadySent) {
      skipped++
      console.info(`  ⏭  ${user.name} (${user.email}) — já enviado hoje`)
      continue
    }

    // Fetch seller info
    const { data: seller } = await supabase
      .from('sellers')
      .select('owner_id')
      .eq('id', user.seller_id)
      .single()

    // Fetch upsell opportunities
    const { data: upsellRaw } = await supabase.rpc('get_upsell_opportunities', {
      p_seller_id: user.seller_id, p_show_contacted: false, p_source: 'mine',
    })
    const upsellOpps = ((upsellRaw ?? []) as UpsellOpp[])

    // Fetch recompra aniversário (mine only)
    const { data: anivRaw } = await supabase.rpc('get_recompra_aniversario_proximo', {
      p_seller_id: user.seller_id, p_show_contacted: false, p_source: 'mine', p_days_ahead: 90,
    })
    const anivOpps = ((anivRaw ?? []) as RecompraAnivOpp[])

    // Fetch recompra festa passada (mine only)
    const { data: festaRaw } = await supabase.rpc('get_recompra_festa_passada', {
      p_seller_id: user.seller_id, p_show_contacted: false, p_source: 'mine',
    })
    const festaOpps = ((festaRaw ?? []) as RecompraFestaOpp[])

    const total = upsellOpps.length + anivOpps.length + festaOpps.length

    if (total === 0) {
      console.info(`  ✅ ${user.name} — 0 oportunidades, pulando`)
      continue
    }

    const html    = buildHtml(user.name, upsellOpps, anivOpps, festaOpps)
    const subject = `${total} oportunidade${total !== 1 ? 's' : ''} de vendas — Cachola OS`

    if (DRY_RUN) {
      console.info(`  [DRY] Enviaria para ${user.name} <${user.email}>`)
      console.info(`        Upsell: ${upsellOpps.length} | Aniversário: ${anivOpps.length} | Festa passada: ${festaOpps.length}`)
      console.info(`        Assunto: "${subject}"`)
    } else {
      try {
        await transport!.sendMail({
          from: `"Cachola OS" <${process.env.SMTP_USER}>`,
          to:   user.email,
          subject,
          html,
        })
        await supabase.from('email_sent_log').insert({
          email_type:        'vendas_daily',
          recipient_user_id: user.id,
          sent_date:         today,
          metadata:          { upsell: upsellOpps.length, aniversario: anivOpps.length, festa_passada: festaOpps.length },
        })
        sent++
        console.info(`  ✅ Enviado para ${user.name} <${user.email}> — ${total} oportunidades`)
      } catch (err) {
        console.error(`  ❌ Falha ao enviar para ${user.name}:`, (err as Error).message)
      }
    }

    void seller // suppress unused warning
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
