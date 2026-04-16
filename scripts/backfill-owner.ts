#!/usr/bin/env tsx
// =============================================================
// Backfill: owner_id + owner_name em ploomes_deals e events
// =============================================================
// Uso: npx tsx scripts/backfill-owner.ts
//
// Etapa 1: Busca TODOS os deals do pipeline na API Ploomes
//          com $expand=Owner e faz upsert em ploomes_deals.
// Etapa 2: Propaga owner_id/owner_name para events via
//          ploomes_deal_id (equivalente a UPDATE JOIN).
//
// Pré-requisitos:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   PLOOMES_USER_KEY, PLOOMES_PIPELINE_ID (opcional, default 60000636)
// =============================================================

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const BASE_URL    = (process.env.PLOOMES_API_URL ?? 'https://api2.ploomes.com/').replace(/\/$/, '')
const PIPELINE_ID = parseInt(process.env.PLOOMES_PIPELINE_ID ?? '60000636', 10)
const PAGE_SIZE   = 100

// ── Ploomes API ───────────────────────────────────────────────

interface PloomesOwner { Id: number; Name: string }
interface PloomesDeal {
  Id: number
  OwnerId?: number
  Owner?: PloomesOwner
}

async function fetchAllDeals(userKey: string): Promise<PloomesDeal[]> {
  const all: PloomesDeal[] = []
  let skip = 0

  while (true) {
    const qs = [
      `$filter=PipelineId eq ${PIPELINE_ID}`,
      `$select=Id,OwnerId`,
      `$expand=Owner($select=Id,Name)`,
      `$top=${PAGE_SIZE}`,
      `$skip=${skip}`,
    ].join('&')

    const res = await fetch(`${BASE_URL}/Deals?${qs}`, {
      headers: { 'User-Key': userKey, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) throw new Error(`Ploomes API ${res.status} (skip=${skip})`)

    const json = (await res.json()) as { value?: PloomesDeal[] }
    const page = json.value ?? []
    all.push(...page)

    console.info(`  · página skip=${skip}: ${page.length} deals`)
    if (page.length < PAGE_SIZE) break
    skip += PAGE_SIZE

    // Rate limit suave
    await new Promise((r) => setTimeout(r, 300))
  }

  return all
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const userKey     = process.env.PLOOMES_USER_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.')
    process.exit(1)
  }
  if (!userKey) {
    console.error('❌ PLOOMES_USER_KEY é obrigatório.')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  // ── Etapa 1: Buscar deals da API Ploomes ─────────────────────
  console.info(`\n── Etapa 1: Buscando deals do pipeline ${PIPELINE_ID}…`)
  const deals = await fetchAllDeals(userKey)
  console.info(`📊 ${deals.length} deals encontrados`)

  const dealsWithOwner = deals.filter((d) => d.Owner?.Name)
  console.info(`👩‍💼 ${dealsWithOwner.length} com Owner preenchido`)

  let step1Updated = 0, step1Skipped = 0, step1Errors = 0

  for (const deal of deals) {
    if (!deal.Owner?.Name) {
      step1Skipped++
      continue
    }

    const { error } = await supabase
      .from('ploomes_deals')
      .update({ owner_id: deal.OwnerId ?? null, owner_name: deal.Owner.Name })
      .eq('ploomes_deal_id', deal.Id)

    if (error) {
      console.error(`❌ ploomes_deals deal ${deal.Id}:`, error.message)
      step1Errors++
    } else {
      step1Updated++
    }
  }

  console.info(`\n── Etapa 1 concluída ─────────────────────────────`)
  console.info(`✅ ploomes_deals atualizados : ${step1Updated}`)
  console.info(`⚠️  Sem owner (pulados)      : ${step1Skipped}`)
  console.info(`❌ Erros                      : ${step1Errors}`)

  // ── Etapa 2: Propagar para events via ploomes_deal_id ────────
  // Equivale a: UPDATE events e SET owner_id=pd.owner_id, owner_name=pd.owner_name
  //             FROM ploomes_deals pd
  //             WHERE e.ploomes_deal_id = pd.ploomes_deal_id::TEXT
  //               AND pd.owner_name IS NOT NULL AND e.owner_name IS NULL
  console.info(`\n── Etapa 2: Propagando para events…`)

  const { data: source, error: srcErr } = await supabase
    .from('ploomes_deals')
    .select('ploomes_deal_id, owner_id, owner_name')
    .not('owner_name', 'is', null)

  if (srcErr) {
    console.error('❌ Erro ao buscar ploomes_deals com owner:', srcErr.message)
    process.exit(1)
  }

  let step2Updated = 0, step2Skipped = 0, step2Errors = 0

  for (const row of source ?? []) {
    const { data: updated, error } = await supabase
      .from('events')
      .update({ owner_id: row.owner_id, owner_name: row.owner_name })
      .eq('ploomes_deal_id', String(row.ploomes_deal_id))
      .is('owner_name', null)          // só atualiza se ainda sem owner
      .select('id')

    if (error) {
      console.error(`❌ events deal ${row.ploomes_deal_id}:`, error.message)
      step2Errors++
    } else if ((updated?.length ?? 0) > 0) {
      step2Updated++
    } else {
      step2Skipped++
    }
  }

  console.info(`\n── Etapa 2 concluída ─────────────────────────────`)
  console.info(`✅ events atualizados : ${step2Updated}`)
  console.info(`⚠️  Sem evento vinculado / já preenchido : ${step2Skipped}`)
  console.info(`❌ Erros              : ${step2Errors}`)
  console.info(`\n✅ Backfill de owner concluído.`)
}

main().catch((err) => {
  console.error('❌ Erro fatal:', err)
  process.exit(1)
})
