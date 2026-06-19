#!/usr/bin/env tsx
// =============================================================
// Discover: FieldKey do campo "Responsavel da decoracao?" em Deals
// =============================================================
// Uso: npx tsx scripts/discover-decoradora-fieldkey.ts
//
// Pré-requisitos:
//   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (lê user_key do banco)
//   OU PLOOMES_USER_KEY como fallback direto
// =============================================================

import dotenv from 'dotenv'
// .env.local tem precedência sobre .env (mesma lógica do Next.js)
dotenv.config({ path: '.env.local' })
dotenv.config()
import { createClient } from '@supabase/supabase-js'

const BASE_URL = (process.env.PLOOMES_API_URL ?? 'https://api2.ploomes.com/').replace(/\/$/, '')
const CACHOLA_PIPELINE_ID = 60000636

async function ploomesGet<T>(path: string, userKey: string): Promise<T> {
  const url = `${BASE_URL}/${path.replace(/^\//, '')}`
  const res = await fetch(url, {
    headers: { 'User-Key': userKey, 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Ploomes ${res.status}: ${body}`)
  }
  const text = await res.text()
  return text ? (JSON.parse(text) as T) : ({} as T)
}

interface PloomesField {
  Id: number
  Name: string
  Key: string
  TypeId: number
  OptionsTableId?: number
  EntityId: number
}

interface OtherProperty {
  FieldKey: string
  StringValue:      string | null
  ObjectValueName:  string | null
  IntegerValue:     number | null
  BoolValue:        boolean | null
  DecimalValue:     number | null
  DateTimeValue:    string | null
}

interface PloomesDeal {
  Id: number
  OtherProperties: OtherProperty[]
}

interface ODataResponse<T> { value: T[] }

async function getUserKey(): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (supabaseUrl && serviceKey) {
    const sb = createClient(supabaseUrl, serviceKey)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (sb as any)
      .from('ploomes_config')
      .select('user_key')
      .eq('is_active', true)
      .limit(1)
      .single()
    if (data?.user_key) return data.user_key as string
  }
  const envKey = process.env.PLOOMES_USER_KEY ?? ''
  if (!envKey) throw new Error('PLOOMES_USER_KEY não configurada e Supabase não disponível')
  return envKey
}

// Detecta qual coluna de valor está preenchida e retorna par {column, value}
function whichValue(prop: OtherProperty): { column: string; value: string } | null {
  if (prop.ObjectValueName !== null) return { column: 'ObjectValueName', value: prop.ObjectValueName }
  if (prop.StringValue      !== null) return { column: 'StringValue',     value: prop.StringValue }
  if (prop.IntegerValue     !== null) return { column: 'IntegerValue',    value: String(prop.IntegerValue) }
  if (prop.DecimalValue     !== null) return { column: 'DecimalValue',    value: String(prop.DecimalValue) }
  if (prop.DateTimeValue    !== null) return { column: 'DateTimeValue',   value: prop.DateTimeValue }
  if (prop.BoolValue        !== null) return { column: 'BoolValue',       value: String(prop.BoolValue) }
  return null
}

// Anonimiza nome de pessoa: mostra 3 chars + ***
function anon(val: string): string { return val.slice(0, 3) + '***' }

const TYPE_LABEL: Record<number, string> = {
  1:  'Texto curto (StringValue)',
  2:  'Texto longo (StringValue)',
  3:  'Inteiro (IntegerValue)',
  4:  'Decimal (DecimalValue)',
  5:  'Data/hora (DateTimeValue)',
  6:  'Booleano (BoolValue)',
  7:  'Lista/Select (ObjectValueName)',
  8:  'Usuário',
  10: 'Checkbox (BoolValue)',
  14: 'Textarea (StringValue)',
}

// Deriva valueKey recomendado pelo TypeId
function valueKeyFor(typeId: number): string {
  if (typeId === 7)                          return 'ObjectValueName'
  if (typeId === 1 || typeId === 2 || typeId === 14) return 'StringValue'
  if (typeId === 5)                          return 'DateTimeValue'
  if (typeId === 6 || typeId === 10)         return 'BoolValue'
  if (typeId === 3)                          return 'IntegerValue'
  if (typeId === 4)                          return 'DecimalValue'
  return 'desconhecido'
}

async function main() {
  const userKey = await getUserKey()
  console.log('[OK] user_key carregada\n')

  // ────────────────────────────────────────────────────────────────
  // PASSO 1 — Buscar campos de Deal que contenham "decora" ou "responsavel"
  // EntityId=2 = Deal (conforme fieldkeys-customs.md)
  // ────────────────────────────────────────────────────────────────
  console.log('=== PASSO 1: Campos de Deal (EntityId=2) com "decora" ou "responsavel" ===\n')

  const terms = ['decora', 'responsavel']
  const seen  = new Set<number>()
  const found: PloomesField[] = []

  for (const term of terms) {
    const res = await ploomesGet<ODataResponse<PloomesField>>(
      `Fields?$filter=EntityId eq 2 and contains(tolower(Name),'${term}')` +
      `&$select=Id,Name,Key,TypeId,OptionsTableId&$top=50`,
      userKey,
    )
    for (const f of res.value ?? []) {
      if (!seen.has(f.Id)) { seen.add(f.Id); found.push(f) }
    }
    await new Promise((r) => setTimeout(r, 300))
  }

  if (found.length === 0) {
    console.log('Nenhum campo encontrado pelos termos buscados.')
    console.log('Listando TODOS os campos de Deal para referência:\n')
    const all = await ploomesGet<ODataResponse<PloomesField>>(
      'Fields?$filter=EntityId eq 2&$select=Id,Name,Key,TypeId&$top=200',
      userKey,
    )
    for (const f of all.value ?? []) {
      console.log(`  Id=${f.Id}  TypeId=${f.TypeId}  Key="${f.Key}"  Name="${f.Name}"`)
    }
    process.exit(0)
  }

  console.log(`Candidatos encontrados: ${found.length}\n`)
  for (const f of found) {
    console.log(`  Id             : ${f.Id}`)
    console.log(`  Name           : "${f.Name}"`)
    console.log(`  Key (FieldKey) : "${f.Key}"`)
    console.log(`  TypeId         : ${f.TypeId} — ${TYPE_LABEL[f.TypeId] ?? 'Desconhecido'}`)
    console.log(`  OptionsTableId : ${f.OptionsTableId ?? '(nenhuma)'}`)
    console.log()
  }

  // ────────────────────────────────────────────────────────────────
  // PASSO 2 — Confirmar valueKey com 10 deals recentes do funil CACHOLA
  // Regra obrigatória: sempre $filter=PipelineId eq 60000636
  // ────────────────────────────────────────────────────────────────
  console.log('=== PASSO 2: Confirmar coluna de valor — 10 deals recentes do funil CACHOLA ===\n')

  const EXPAND_OP = `OtherProperties($select=FieldKey,StringValue,ObjectValueName,IntegerValue,BoolValue,DecimalValue,DateTimeValue)`
  const sampleRes = await ploomesGet<ODataResponse<PloomesDeal>>(
    `Deals?$filter=PipelineId eq ${CACHOLA_PIPELINE_ID}` +
    `&$select=Id&$expand=${EXPAND_OP}&$orderby=LastUpdateDate desc&$top=10`,
    userKey,
  )
  const sample = sampleRes.value ?? []
  console.log(`Deals na amostra: ${sample.length}\n`)

  const foundKeys = found.map((f) => f.Key)

  for (const key of foundKeys) {
    const meta = found.find((f) => f.Key === key)!
    console.log(`--- FieldKey: "${key}"  (${meta.Name}) ---`)
    let filledCount = 0
    const colCounts: Record<string, number> = {}

    for (const deal of sample) {
      const prop = deal.OtherProperties?.find((p) => p.FieldKey === key)
      if (!prop) continue
      const result = whichValue(prop)
      if (!result) continue
      filledCount++
      colCounts[result.column] = (colCounts[result.column] ?? 0) + 1
      // Anonimiza nomes de pessoa; datas mostram só data (não sensível)
      const display = result.column === 'DateTimeValue'
        ? result.value.slice(0, 10)
        : anon(result.value)
      console.log(`  Deal ${deal.Id}: ${result.column} = ${display}`)
    }

    if (filledCount === 0) {
      console.log(`  (nenhum dos ${sample.length} deals tinha este campo preenchido)`)
    } else {
      console.log(`  Preenchidos : ${filledCount}/${sample.length}`)
      console.log(`  Colunas     : ${JSON.stringify(colCounts)}`)
    }
    console.log()
  }

  // ────────────────────────────────────────────────────────────────
  // PASSO 3 — Cobertura ampliada: 50 deals ganhos do funil CACHOLA
  // (para decidir sobre backfill)
  // ────────────────────────────────────────────────────────────────
  console.log('=== PASSO 3: Cobertura — 50 deals ganhos (StatusId=2) do funil CACHOLA ===\n')

  await new Promise((r) => setTimeout(r, 600))

  const coverRes = await ploomesGet<ODataResponse<PloomesDeal>>(
    `Deals?$filter=PipelineId eq ${CACHOLA_PIPELINE_ID} and StatusId eq 2` +
    `&$select=Id&$expand=${EXPAND_OP}&$orderby=LastUpdateDate desc&$top=50`,
    userKey,
  )
  const cover = coverRes.value ?? []
  console.log(`Deals ganhos na amostra: ${cover.length}\n`)

  for (const key of foundKeys) {
    const meta    = found.find((f) => f.Key === key)!
    const withVal = cover.filter((d) => {
      const prop = d.OtherProperties?.find((p) => p.FieldKey === key)
      return prop ? whichValue(prop) !== null : false
    })
    const pct = cover.length ? Math.round((withVal.length / cover.length) * 100) : 0
    console.log(`  "${meta.Name}": ${withVal.length}/${cover.length} preenchidos (${pct}%)`)
  }

  // ────────────────────────────────────────────────────────────────
  // RESUMO FINAL
  // ────────────────────────────────────────────────────────────────
  console.log('\n=== RESUMO FINAL ===\n')

  for (const f of found) {
    const vKey   = valueKeyFor(f.TypeId)
    const parser = TYPE_LABEL[f.TypeId] ?? `TypeId ${f.TypeId}`
    const withVal = cover.filter((d) => {
      const prop = d.OtherProperties?.find((p) => p.FieldKey === f.Key)
      return prop ? whichValue(prop) !== null : false
    })
    const pct = cover.length ? Math.round((withVal.length / cover.length) * 100) : 0

    console.log(`Campo          : "${f.Name}"`)
    console.log(`  FieldKey     : ${f.Key}`)
    console.log(`  valueKey     : ${vKey}`)
    console.log(`  Parser       : ${parser}`)
    console.log(`  Cobertura    : ${withVal.length}/${cover.length} deals ganhos recentes (${pct}%) — ${pct >= 50 ? 'backfill recomendado' : 'cobertura baixa, decidir com Bruno'}`)
    console.log()
  }
}

main().catch((err) => {
  console.error('[ERRO]', err)
  process.exit(1)
})
