#!/usr/bin/env tsx
// =============================================================
// Sync: ploomes_contacts — espelho local de contatos Ploomes
//       com "Cliente Cachola = Sim"
// =============================================================
// Estratégia: a API Ploomes não permite filtrar por OtherProperties
// com a user_key disponível. Em vez disso, obtemos os e-mails
// únicos dos contatos em ploomes_deals (negócios no pipeline) e
// buscamos cada contato por e-mail na API Ploomes.
//
// Uso:
//   npx tsx scripts/ploomes-sync-contacts.ts --mode=full
//   npx tsx scripts/ploomes-sync-contacts.ts --mode=incremental
//
// --mode=full        Sincroniza todos os contatos únicos em ploomes_deals
// --mode=incremental Sincroniza apenas os de deals criados/atualizados
//                    desde o último sync (usa MAX(synced_at) da tabela local)
//
// Pré-requisitos:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   PLOOMES_USER_KEY (ou registrado em ploomes_config)
// =============================================================

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const BASE_URL  = (process.env.PLOOMES_API_URL ?? 'https://api2.ploomes.com/').replace(/\/$/, '')
const RATE_MS   = 600  // 120 req/min limit → ~500ms min; 600ms is safe

// ── Ploomes types ─────────────────────────────────────────────

interface PloomesPhone {
  PhoneTypeId?:   number
  PhoneTypeName?: string
  PhoneNumber?:   string
}

interface PloomesOwner {
  Id:    number
  Name:  string
}

interface PloomesContact {
  Id:                  number
  Name:                string
  LegalName?:          string
  Email?:              string
  Birthday?:           string
  NextAnniversary?:    string
  PreviousAnniversary?: string
  OwnerId?:            number
  Owner?:              PloomesOwner
  Phones?:             PloomesPhone[]
  CreateDate?:         string
  LastUpdateDate?:     string
}

// ── Ploomes fetch ─────────────────────────────────────────────

async function ploomesGet<T>(path: string, userKey: string, retries = 2): Promise<T> {
  const url = `${BASE_URL}/${path.replace(/^\//, '')}`
  const res = await fetch(url, {
    headers: { 'User-Key': userKey, 'Content-Type': 'application/json' },
    signal:  AbortSignal.timeout(15_000),
  })
  if (res.status === 429 && retries > 0) {
    console.warn(`  ⏳ 429 rate limit — aguardando 65s…`)
    await new Promise((r) => setTimeout(r, 65_000))
    return ploomesGet<T>(path, userKey, retries - 1)
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Ploomes ${res.status} (${path.slice(0, 80)}): ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

async function findContactByEmail(email: string, userKey: string): Promise<PloomesContact | null> {
  const encoded = email.replace(/'/g, "''")  // escape single quotes for OData
  const path = `Contacts?$filter=Email eq '${encoded}'&$top=1&$select=Id,Name,LegalName,Email,Birthday,NextAnniversary,PreviousAnniversary,OwnerId,CreateDate,LastUpdateDate&$expand=Phones,Owner($select=Id,Name)`
  const res = await ploomesGet<{ value?: PloomesContact[] }>(path, userKey)
  return res.value?.[0] ?? null
}

async function findContactByName(name: string, userKey: string): Promise<PloomesContact | null> {
  const escaped = name.replace(/'/g, "''")
  const path = `Contacts?$filter=Name eq '${escaped}'&$top=1&$select=Id,Name,LegalName,Email,Birthday,NextAnniversary,PreviousAnniversary,OwnerId,CreateDate,LastUpdateDate&$expand=Phones,Owner($select=Id,Name)`
  const res = await ploomesGet<{ value?: PloomesContact[] }>(path, userKey)
  return res.value?.[0] ?? null
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  const args    = process.argv.slice(2)
  const modeArg = args.find((a) => a.startsWith('--mode='))?.split('=')[1]

  if (modeArg !== 'full' && modeArg !== 'incremental' && modeArg !== 'retry') {
    console.error('❌ Uso: npx tsx scripts/ploomes-sync-contacts.ts --mode=full|incremental|retry')
    process.exit(1)
  }
  const mode: 'full' | 'incremental' | 'retry' = modeArg

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.')
    process.exit(1)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }) as any

  // Carregar user_key
  let userKey = process.env.PLOOMES_USER_KEY ?? ''
  if (!userKey) {
    const { data } = await supabase.from('ploomes_config').select('user_key').eq('is_active', true).limit(1).single()
    userKey = data?.user_key ?? ''
  }
  if (!userKey) {
    console.error('❌ PLOOMES_USER_KEY não encontrada (env nem ploomes_config).')
    process.exit(1)
  }
  console.info('[OK] user_key carregada\n')

  // ── Determinar quais contatos sincronizar ─────────────────────
  let sinceFilter = ''
  let knownEmails: Set<string> | null = null

  if (mode === 'incremental') {
    const { data: maxRow } = await supabase
      .from('ploomes_contacts')
      .select('synced_at')
      .order('synced_at', { ascending: false })
      .limit(1)
      .single()

    if (maxRow?.synced_at) {
      sinceFilter = maxRow.synced_at as string
      console.info(`🕐 Incremental desde: ${sinceFilter}`)
    } else {
      console.warn('⚠️  Tabela vazia — rodando como full.')
    }
  }

  if (mode === 'retry') {
    // Retry: only emails NOT yet in ploomes_contacts
    const { data: existing } = await supabase
      .from('ploomes_contacts')
      .select('email')
      .not('email', 'is', null)
    knownEmails = new Set((existing ?? []).map((r: { email: string }) => r.email?.toLowerCase()))
    console.info(`📦 Contatos já sincronizados: ${knownEmails.size}`)
  }

  // Buscar tuplas (contact_email, contact_name, owner_id, owner_name) de ploomes_deals
  let dealsQuery = supabase
    .from('ploomes_deals')
    .select('contact_email, contact_name, owner_id, owner_name')
    .not('contact_email', 'is', null)

  if (sinceFilter) {
    dealsQuery = dealsQuery.gte('ploomes_create_date', sinceFilter)
  }

  const { data: dealRows, error: dealErr } = await dealsQuery
  if (dealErr) {
    console.error('❌ Erro ao buscar ploomes_deals:', dealErr.message)
    process.exit(1)
  }

  // Deduplicar por e-mail (case insensitive), mantendo o mais recente owner
  const byEmail = new Map<string, { name: string; owner_id: number | null; owner_name: string | null }>()
  for (const row of dealRows ?? []) {
    const email = (row.contact_email as string).toLowerCase().trim()
    if (!byEmail.has(email)) {
      byEmail.set(email, {
        name:       row.contact_name ?? '',
        owner_id:   row.owner_id ?? null,
        owner_name: row.owner_name ?? null,
      })
    }
  }

  console.info(`📋 Contatos únicos (por e-mail) em ploomes_deals: ${byEmail.size}`)

  // Filter out already-synced in retry mode
  let entries = Array.from(byEmail.entries())
  if (knownEmails) {
    entries = entries.filter(([email]) => !knownEmails!.has(email))
    console.info(`🔄 Pendentes (não sincronizados): ${entries.length}`)
  }

  console.info(`\n── Buscando contatos na API Ploomes…\n`)

  let found    = 0
  let notFound = 0
  let errors   = 0
  let upserted = 0
  let upsertErr = 0

  for (let i = 0; i < entries.length; i++) {
    const [email, meta] = entries[i]

    if (i > 0 && i % 50 === 0) {
      console.info(`  · progresso: ${i}/${entries.length} (encontrados: ${found}, não encontrados: ${notFound})`)
    }

    let contact: PloomesContact | null = null

    try {
      contact = await findContactByEmail(email, userKey)

      // Fallback por nome se não encontrado por e-mail
      if (!contact && meta.name) {
        contact = await findContactByName(meta.name, userKey)
      }
    } catch (err) {
      console.error(`❌ API error para ${email}: ${(err as Error).message}`)
      errors++
      await new Promise((r) => setTimeout(r, RATE_MS))
      continue
    }

    if (!contact) {
      notFound++
      await new Promise((r) => setTimeout(r, RATE_MS))
      continue
    }

    found++

    const row = {
      ploomes_contact_id:   contact.Id,
      name:                 contact.Name,
      legal_name:           contact.LegalName ?? null,
      email:                contact.Email ?? null,
      phones:               contact.Phones?.length ? contact.Phones : null,
      birthday:             contact.Birthday ? contact.Birthday.slice(0, 10) : null,
      next_anniversary:     contact.NextAnniversary ? contact.NextAnniversary.slice(0, 10) : null,
      previous_anniversary: contact.PreviousAnniversary ? contact.PreviousAnniversary.slice(0, 10) : null,
      owner_id:             contact.OwnerId ?? contact.Owner?.Id ?? meta.owner_id ?? null,
      owner_name:           contact.Owner?.Name ?? meta.owner_name ?? null,
      cliente_cachola:      true,
      ploomes_create_date:  contact.CreateDate ?? null,
      ploomes_update_date:  contact.LastUpdateDate ?? null,
      synced_at:            new Date().toISOString(),
    }

    const { error: upsertError } = await supabase
      .from('ploomes_contacts')
      .upsert(row, { onConflict: 'ploomes_contact_id' })

    if (upsertError) {
      console.error(`❌ Upsert ${contact.Id} (${contact.Name}): ${upsertError.message}`)
      upsertErr++
    } else {
      upserted++
    }

    await new Promise((r) => setTimeout(r, RATE_MS))
  }

  console.info(`\n── Resultado ─────────────────────────────────────`)
  console.info(`✅ Encontrados na API     : ${found}`)
  console.info(`⚠️  Não encontrados        : ${notFound}`)
  console.info(`❌ Erros de API           : ${errors}`)
  console.info(`✅ Upsertados no banco    : ${upserted}`)
  console.info(`❌ Erros de upsert        : ${upsertErr}`)
  console.info(`\n✅ Sync de contatos concluído.`)
}

main().catch((err) => {
  console.error('❌ Erro fatal:', err)
  process.exit(1)
})
