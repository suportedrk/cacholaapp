#!/usr/bin/env tsx
// =============================================================
// Discover: FieldKeys dos 9 campos NOVOS "CHECKLIST - DECORAÇÃO" no Ploomes
// (os outros 7 campos do checklist de decoração já estão mapeados:
//  theme, decorator_name, setup_time, teardown_time, briefing,
//  cake_flavor, has_decorated_sweets) — SOMENTE LEITURA
// =============================================================
// Uso: npx tsx scripts/discover-checklist-decoracao-fieldkeys.ts
//
// Pré-requisitos:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (para ler user_key)
//   OU PLOOMES_USER_KEY como fallback
//
// NÃO altera field-mapping.ts, types.ts nem o banco.
// =============================================================

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const BASE_URL    = (process.env.PLOOMES_API_URL ?? 'https://api2.ploomes.com/').replace(/\/$/, '')
const PIPELINE_ID = 60000636  // Funil CACHOLA — obrigatório em toda query de Deals

// ── TypeId → metadados (combinação empírica + documentação Ploomes) ──────────
const TYPE_INFO: Record<number, { label: string; valueKey: string; parser: string }> = {
  1:  { label: 'Texto curto',       valueKey: 'StringValue',    parser: 'string' },
  2:  { label: 'Texto longo',       valueKey: 'BigStringValue', parser: 'string' },
  3:  { label: 'Inteiro',           valueKey: 'IntegerValue',   parser: 'number' },
  4:  { label: 'Decimal',           valueKey: 'DecimalValue',   parser: 'number' },
  5:  { label: 'Data/hora',         valueKey: 'DateTimeValue',  parser: 'date'   },
  6:  { label: 'Booleano',          valueKey: 'BoolValue',      parser: 'bool'   },
  7:  { label: 'Lista/opção',       valueKey: 'ObjectValueName',parser: 'string' },
  10: { label: 'Booleano (alt)',     valueKey: 'BoolValue',      parser: 'bool'   },
  11: { label: 'Número (alt)',       valueKey: 'IntegerValue',   parser: 'number' },
  14: { label: 'Textarea (alt)',     valueKey: 'BigStringValue', parser: 'string' },
}

// ── 9 rótulos alvo NOVOS — EXATAMENTE como o Bruno os listou ────────────────
// matches() com '.*' exige TODOS os pedaços presentes; sem '.*' é substring.
const TARGETS: Array<{ rotulo: string; termos: string[] }> = [
  { rotulo: 'Responsável da Decoração - Observações', termos: ['responsável.*decoração.*observ', 'decoradora.*observ', 'responsável da decoração'] },
  { rotulo: 'Forminhas - Cores',                       termos: ['forminha.*cor', 'forminha'] },
  { rotulo: 'Oficinas - Observações',                  termos: ['oficina.*observ', 'oficina'] },
  { rotulo: 'Balões - Valor cobrado',                  termos: ['balõe.*valor', 'balão.*valor', 'balao.*valor', 'bal.*valor cobrado'] },
  { rotulo: 'Balões - Observações',                    termos: ['balõe.*observ', 'balão.*observ', 'balao.*observ'] },
  { rotulo: 'Bolo Fake - Valor Cobrado',               termos: ['bolo fake.*valor', 'fake.*valor cobrado', 'fake.*valor'] },
  { rotulo: 'Bolo Fake - Observações',                 termos: ['bolo fake.*observ', 'fake.*observ'] },
  { rotulo: 'Doces Decorados - Observações',           termos: ['doces decorados.*observ', 'decorados.*observ', 'doce.*decorado.*observ'] },
  { rotulo: 'Adicionais de Decoração - Observações',   termos: ['adicionais.*decoração.*observ', 'adicionais.*decor', 'adicional.*decor'] },
]

// ── Types ────────────────────────────────────────────────────────────────────

interface PloomesField {
  Id:              number
  Name:            string
  Key:             string
  TypeId:          number
  OptionsTableId?: number
}

interface PloomesOtherProperty {
  FieldKey:        string
  StringValue?:    string | null
  BigStringValue?: string | null
  IntegerValue?:   number | null
  DecimalValue?:   number | null
  DateTimeValue?:  string | null
  BoolValue?:      boolean | null
  ObjectValueName?: string | null
}

interface PloomesPartialDeal {
  Id:              number
  Title?:          string
  OtherProperties?: PloomesOtherProperty[]
}

interface ODataResponse<T> { value: T[] }

// ── Helpers ──────────────────────────────────────────────────────────────────

async function ploomesGet<T>(path: string, userKey: string): Promise<T> {
  const url = `${BASE_URL}/${path.replace(/^\//, '')}`
  const res = await fetch(url, { headers: { 'User-Key': userKey, 'Content-Type': 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Ploomes ${res.status}: ${body}`)
  }
  const text = await res.text()
  return text ? (JSON.parse(text) as T) : ({} as T)
}

async function getUserKey(): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (supabaseUrl && serviceKey) {
    const sb = createClient(supabaseUrl, serviceKey)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (sb as any).from('ploomes_config').select('user_key').eq('is_active', true).limit(1).single()
    if (data?.user_key) return data.user_key as string
  }
  const envKey = process.env.PLOOMES_USER_KEY ?? ''
  if (!envKey) throw new Error('PLOOMES_USER_KEY não configurada e NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes')
  return envKey
}

/** Retorna o primeiro valueKey não-nulo encontrado no OtherProperty */
function detectValueKey(prop: PloomesOtherProperty): { key: string; value: unknown } | null {
  const candidates: Array<[keyof PloomesOtherProperty, unknown]> = [
    ['BoolValue',       prop.BoolValue],
    ['IntegerValue',    prop.IntegerValue],
    ['DecimalValue',    prop.DecimalValue],
    ['DateTimeValue',   prop.DateTimeValue],
    ['StringValue',     prop.StringValue],
    ['BigStringValue',  prop.BigStringValue],
    ['ObjectValueName', prop.ObjectValueName],
  ]
  for (const [k, v] of candidates) {
    if (v !== null && v !== undefined) return { key: k as string, value: v }
  }
  return null
}

/** Verifica se o Name do campo bate com ao menos 1 dos termos do target */
function matches(fieldName: string, termos: string[]): boolean {
  const lower = fieldName.toLowerCase()
  return termos.some(t => {
    // suporte a regex simples com .*
    if (t.includes('.*')) {
      const parts = t.split('.*')
      return parts.every(p => lower.includes(p.toLowerCase()))
    }
    return lower.includes(t.toLowerCase())
  })
}

// ── Passos ───────────────────────────────────────────────────────────────────

async function fetchAllDealFields(userKey: string): Promise<PloomesField[]> {
  console.log('Buscando campos do Deal (EntityId=2) via /Fields (paginado)...')
  const all: PloomesField[] = []
  let skip = 0
  const top = 200
  while (true) {
    const res = await ploomesGet<ODataResponse<PloomesField>>(
      `Fields?$filter=EntityId eq 2&$select=Id,Name,Key,TypeId,OptionsTableId&$top=${top}&$skip=${skip}`,
      userKey,
    )
    const page = res.value ?? []
    all.push(...page)
    if (page.length < top) break
    skip += top
    await new Promise(r => setTimeout(r, 350))
  }
  console.log(`  Total de campos Deal: ${all.length}\n`)
  return all
}

async function sampleCachalaDeals(userKey: string, count = 50): Promise<PloomesPartialDeal[]> {
  console.log(`Amostrando ${count} deals recentes do funil CACHOLA (PipelineId=${PIPELINE_ID})...`)
  const all: PloomesPartialDeal[] = []
  let skip = 0
  const top = 50
  while (all.length < count) {
    const res = await ploomesGet<ODataResponse<PloomesPartialDeal>>(
      `Deals?$filter=PipelineId eq ${PIPELINE_ID}` +
      `&$expand=OtherProperties($select=FieldKey,StringValue,BigStringValue,IntegerValue,DecimalValue,DateTimeValue,BoolValue,ObjectValueName)` +
      `&$select=Id,Title&$top=${top}&$skip=${skip}&$orderby=LastUpdateDate desc`,
      userKey,
    )
    const page = res.value ?? []
    all.push(...page)
    if (page.length < top || all.length >= count) break
    skip += top
    await new Promise(r => setTimeout(r, 450))
  }
  const sample = all.slice(0, count)
  console.log(`  Deals na amostra: ${sample.length}\n`)
  return sample
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const userKey = await getUserKey()
  console.log('[OK] user_key carregada\n')
  console.log('═'.repeat(72))
  console.log('DISCOVER — 9 campos NOVOS do CHECKLIST DE DECORAÇÃO')
  console.log('═'.repeat(72))
  console.log()

  // ── Passo 1: todos os campos de Deal ────────────────────────────────────
  const allFields = await fetchAllDealFields(userKey)

  // ── Passo 2: match dos 9 alvos ──────────────────────────────────────────
  console.log('─'.repeat(72))
  console.log('MATCH por Name nos campos do Ploomes')
  console.log('─'.repeat(72))
  console.log()

  interface MatchResult {
    rotulo:    string
    field:     PloomesField | null
    multiHit:  PloomesField[]
  }

  const matchResults: MatchResult[] = []
  for (const target of TARGETS) {
    const hits = allFields.filter(f => matches(f.Name, target.termos))
    const best = hits.length === 1 ? hits[0] : hits.find(f => f.Name.toLowerCase().trim() === target.rotulo.toLowerCase().trim()) ?? hits[0] ?? null
    matchResults.push({ rotulo: target.rotulo, field: best ?? null, multiHit: hits })

    if (best) {
      const ti = TYPE_INFO[best.TypeId]
      console.log(`  ✅  ${target.rotulo}`)
      console.log(`       Name     : "${best.Name}"`)
      console.log(`       FieldKey : ${best.Key}`)
      console.log(`       TypeId   : ${best.TypeId} → ${ti?.label ?? 'Desconhecido'}`)
      console.log(`       ValueKey : ${ti?.valueKey ?? '?'} (inferido do TypeId)`)
      if (hits.length > 1) {
        console.log(`       ⚠️  ${hits.length} hits — outros candidatos:`)
        hits.slice(1).forEach(h => console.log(`          - "${h.Name}" (${h.Key})`))
      }
    } else {
      console.log(`  ❓  ${target.rotulo} → NAO ENCONTRADO por Name`)
      console.log(`       Termos buscados: ${target.termos.join(', ')}`)
    }
    console.log()
  }

  // ── Passo 3: amostra de deals para confirmar valores ────────────────────
  const deals = await sampleCachalaDeals(userKey)

  console.log('─'.repeat(72))
  console.log('VALORES REAIS nos deals amostrados')
  console.log('─'.repeat(72))
  console.log()

  // ── Passo 4: consolidar resultado por campo ──────────────────────────────

  interface Summary {
    rotulo:    string
    fieldKey:  string
    valueKey:  string  // detectado empiricamente, ou inferido do TypeId
    parser:    string
    exemplo:   string
    cobertura: string
  }

  const summaries: Summary[] = []

  for (const { rotulo, field } of matchResults) {
    if (!field) {
      summaries.push({ rotulo, fieldKey: 'NAO ENCONTRADO', valueKey: '-', parser: '-', exemplo: '-', cobertura: '-' })
      continue
    }

    let exampleValue = '-'
    let detectedValueKey = TYPE_INFO[field.TypeId]?.valueKey ?? '?'
    let filledCount = 0

    for (const deal of deals) {
      const prop = deal.OtherProperties?.find(p => p.FieldKey === field.Key)
      if (!prop) continue
      const detected = detectValueKey(prop)
      if (detected) {
        filledCount++
        if (exampleValue === '-') {
          detectedValueKey = detected.key  // sobrescreve inferência com valor real
          const raw = detected.value
          const str = String(raw)
          exampleValue = str.length > 70 ? str.substring(0, 70) + '…' : str
        }
      }
    }

    const coverage = deals.length > 0
      ? `${filledCount}/${deals.length} (${Math.round(filledCount / deals.length * 100)}%)`
      : '-'

    const ti = TYPE_INFO[field.TypeId]
    const parser = ti?.parser ?? '?'

    summaries.push({ rotulo, fieldKey: field.Key, valueKey: detectedValueKey, parser, exemplo: exampleValue, cobertura: coverage })

    console.log(`  ${rotulo}`)
    console.log(`    FieldKey  : ${field.Key}`)
    console.log(`    ValueKey  : ${detectedValueKey}${filledCount === 0 ? ' (inferido — sem exemplo)' : ' (confirmado)'}`)
    console.log(`    Parser    : ${parser}`)
    console.log(`    Cobertura : ${coverage}`)
    if (exampleValue !== '-') console.log(`    Exemplo   : ${exampleValue}`)
    console.log()
  }

  // ── Passo 5: tabela final ────────────────────────────────────────────────
  console.log('═'.repeat(72))
  console.log('TABELA FINAL — 9 CAMPOS NOVOS CHECKLIST DECORAÇÃO')
  console.log('═'.repeat(72))
  console.log()
  console.log('Rótulo                                       | FieldKey                                    | ValueKey        | Parser | Exemplo')
  console.log('─'.repeat(130))
  for (const s of summaries) {
    const r = s.rotulo.padEnd(44)
    const k = s.fieldKey.padEnd(44)
    const v = s.valueKey.padEnd(16)
    const p = s.parser.padEnd(7)
    console.log(`${r} | ${k} | ${v} | ${p} | ${s.exemplo}`)
  }
  console.log()

  // ── Passo 6: referência completa de campos de Deal ───────────────────────
  console.log('─'.repeat(72))
  console.log(`REFERÊNCIA — Todos os ${allFields.length} campos de Deal no Ploomes`)
  console.log('─'.repeat(72))
  for (const f of allFields) {
    const ti = TYPE_INFO[f.TypeId]
    console.log(`  TypeId=${String(f.TypeId).padEnd(3)} Key=${f.Key.padEnd(46)} Name="${f.Name}"${ti ? ` (${ti.label})` : ''}`)
  }
}

main().catch(err => {
  console.error('[ERRO]', err)
  process.exit(1)
})
