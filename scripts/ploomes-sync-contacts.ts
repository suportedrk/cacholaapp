#!/usr/bin/env tsx
// =============================================================
// Sync: ploomes_contacts — espelho local de contatos Ploomes
//       com "Cliente Cachola = Sim"
// =============================================================
// Uso:
//   npx tsx scripts/ploomes-sync-contacts.ts --mode=full
//   npx tsx scripts/ploomes-sync-contacts.ts --mode=incremental
//
// --mode=full        Busca TODOS os contatos com Cliente Cachola=Sim
// --mode=incremental Busca apenas os atualizados desde o último sync
//                    (usa MAX(ploomes_update_date) da tabela local)
//
// Pré-requisitos:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   PLOOMES_USER_KEY (ou registrado em ploomes_config)
// =============================================================

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const BASE_URL  = (process.env.PLOOMES_API_URL ?? 'https://api2.ploomes.com/').replace(/\/$/, '')
const PAGE_SIZE = 100

// FieldKey do campo "Cliente Cachola ?" — TypeId=10 (checkbox boolean)
// Descoberto via scripts/discover-cliente-cachola-fieldkey.ts
const CLIENTE_CACHOLA_FIELD_KEY = 'contact_E2B745FB-3675-4C1D-9A14-7EBE88815C10'

// ── Ploomes types ─────────────────────────────────────────────

interface PloomesPhone {
  PhoneTypeId?: number
  PhoneTypeName?: string
  PhoneNumber?: string
}

interface PloomesOwner {
  Id:    number
  Name:  string
  Email?: string
}

interface PloomesContact {
  Id:                number
  Name:              string
  LegalName?:        string
  Email?:            string
  Phones?:           PloomesPhone[]
  Birthday?:         string   // ISO "YYYY-MM-DDTHH:mm:ss"
  OwnerId?:          number
  Owner?:            PloomesOwner
  CreateDate?:       string
  LastUpdateDate?:   string
}

// ── Anniversary helpers ───────────────────────────────────────

function computeAnniversaries(birthday: string | undefined): {
  next: string | null
  previous: string | null
} {
  if (!birthday) return { next: null, previous: null }

  const d = new Date(birthday)
  if (isNaN(d.getTime())) return { next: null, previous: null }

  const month = d.getUTCMonth()  // 0-based
  const day   = d.getUTCDate()
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const thisYear = today.getUTCFullYear()

  // Candidate in current year
  const thisYearDate = new Date(Date.UTC(thisYear, month, day))

  let nextDate: Date
  let prevDate: Date

  if (thisYearDate >= today) {
    nextDate = thisYearDate
    prevDate = new Date(Date.UTC(thisYear - 1, month, day))
  } else {
    nextDate = new Date(Date.UTC(thisYear + 1, month, day))
    prevDate = thisYearDate
  }

  const fmt = (dt: Date) => dt.toISOString().slice(0, 10)
  return { next: fmt(nextDate), previous: fmt(prevDate) }
}

// ── Ploomes fetch ─────────────────────────────────────────────

async function ploomesGet<T>(path: string, userKey: string): Promise<T> {
  const url = `${BASE_URL}/${path.replace(/^\//, '')}`
  const res = await fetch(url, {
    headers: { 'User-Key': userKey, 'Content-Type': 'application/json' },
    signal:  AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Ploomes ${res.status} (${url}): ${body}`)
  }
  return res.json() as Promise<T>
}

async function fetchContacts(
  userKey:      string,
  mode:         'full' | 'incremental',
  sinceDate?:   string,
): Promise<PloomesContact[]> {
  const all: PloomesContact[] = []
  let skip = 0

  // Base filter: only "Cliente Cachola = Sim"
  const clienteFilter = `OtherProperties/any(op: op/FieldKey eq '${CLIENTE_CACHOLA_FIELD_KEY}' and op/BigIntegerValue eq 1)`

  // Incremental filter: updated since lastSync
  const incrementalFilter = sinceDate
    ? ` and LastUpdateDate gt ${sinceDate}`
    : ''

  const filter = clienteFilter + incrementalFilter

  while (true) {
    const qs = [
      `$filter=${filter}`,
      `$select=Id,Name,LegalName,Email,Phones,Birthday,OwnerId,CreateDate,LastUpdateDate`,
      `$expand=Owner($select=Id,Name,Email)`,
      `$top=${PAGE_SIZE}`,
      `$skip=${skip}`,
    ].join('&')

    const res = await ploomesGet<{ value?: PloomesContact[] }>(
      `Contacts?${qs}`,
      userKey,
    )
    const page = res.value ?? []
    all.push(...page)

    console.info(`  · skip=${skip}: ${page.length} contatos`)
    if (page.length < PAGE_SIZE) break
    skip += PAGE_SIZE

    await new Promise((r) => setTimeout(r, 300))
  }

  return all
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const modeArg = args.find((a) => a.startsWith('--mode='))?.split('=')[1]

  if (modeArg !== 'full' && modeArg !== 'incremental') {
    console.error('❌ Uso: npx tsx scripts/ploomes-sync-contacts.ts --mode=full|incremental')
    process.exit(1)
  }
  const mode: 'full' | 'incremental' = modeArg

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.')
    process.exit(1)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  }) as any

  // Carregar user_key do ploomes_config ou env
  let userKey = process.env.PLOOMES_USER_KEY ?? ''
  if (!userKey) {
    const { data } = await supabase
      .from('ploomes_config')
      .select('user_key')
      .eq('is_active', true)
      .limit(1)
      .single()
    userKey = data?.user_key ?? ''
  }
  if (!userKey) {
    console.error('❌ PLOOMES_USER_KEY não encontrada (env nem ploomes_config).')
    process.exit(1)
  }
  console.info('[OK] user_key carregada\n')

  // Para incremental, buscar o MAX(ploomes_update_date) da tabela
  let sinceDate: string | undefined
  if (mode === 'incremental') {
    const { data: maxRow } = await supabase
      .from('ploomes_contacts')
      .select('ploomes_update_date')
      .not('ploomes_update_date', 'is', null)
      .order('ploomes_update_date', { ascending: false })
      .limit(1)
      .single()

    if (maxRow?.ploomes_update_date) {
      // OData datetime format: 2025-01-01T00:00:00Z
      sinceDate = new Date(maxRow.ploomes_update_date).toISOString()
      console.info(`🕐 Incremental desde: ${sinceDate}`)
    } else {
      console.warn('⚠️  Tabela vazia — rodando como full.')
    }
  }

  // Buscar contatos
  console.info(`\n── Buscando contatos Ploomes (mode=${mode})…`)
  const contacts = await fetchContacts(userKey, mode, sinceDate)
  console.info(`\n📊 Total encontrado: ${contacts.length} contatos\n`)

  if (contacts.length === 0) {
    console.info('Nada a sincronizar.')
    return
  }

  // Upsert em lotes
  const BATCH = 50
  let upserted = 0
  let errors   = 0

  for (let i = 0; i < contacts.length; i += BATCH) {
    const batch = contacts.slice(i, i + BATCH)

    const rows = batch.map((c) => {
      const { next, previous } = computeAnniversaries(c.Birthday)

      return {
        ploomes_contact_id:   c.Id,
        name:                 c.Name,
        legal_name:           c.LegalName ?? null,
        email:                c.Email ?? null,
        phones:               c.Phones?.length ? c.Phones : null,
        birthday:             c.Birthday ? c.Birthday.slice(0, 10) : null,
        next_anniversary:     next,
        previous_anniversary: previous,
        owner_id:             c.OwnerId ?? c.Owner?.Id ?? null,
        owner_name:           c.Owner?.Name ?? null,
        cliente_cachola:      true,
        ploomes_create_date:  c.CreateDate ?? null,
        ploomes_update_date:  c.LastUpdateDate ?? null,
        synced_at:            new Date().toISOString(),
      }
    })

    const { error } = await supabase
      .from('ploomes_contacts')
      .upsert(rows, { onConflict: 'ploomes_contact_id' })

    if (error) {
      console.error(`❌ Upsert batch ${i}–${i + batch.length}: ${error.message}`)
      errors += batch.length
    } else {
      upserted += batch.length
    }
  }

  console.info(`\n── Resultado ─────────────────────────────────────`)
  console.info(`✅ Upsertados : ${upserted}`)
  console.info(`❌ Erros      : ${errors}`)
  console.info(`\n✅ Sync de contatos concluído.`)
}

main().catch((err) => {
  console.error('❌ Erro fatal:', err)
  process.exit(1)
})
