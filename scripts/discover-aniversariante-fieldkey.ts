#!/usr/bin/env tsx
// =============================================================
// Discover: FieldKey do campo "Data de Nascimento do Aniversariante"
// em Deals — confirmação via API Ploomes
// =============================================================
// Uso: npx tsx scripts/discover-aniversariante-fieldkey.ts
//
// Pré-requisitos:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (para ler user_key)
//   OU PLOOMES_USER_KEY como fallback
// =============================================================

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const BASE_URL = (process.env.PLOOMES_API_URL ?? 'https://api2.ploomes.com/').replace(/\/$/, '')

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

interface ODataResponse<T> {
  value: T[]
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
  if (!envKey) throw new Error('PLOOMES_USER_KEY não configurada')
  return envKey
}

async function main() {
  const userKey = await getUserKey()
  console.log('[OK] user_key carregada\n')
  console.log('=== BUSCA: Campos de Deal com "nascimento" / "aniversariante" / "criança" / "Data" ===\n')

  // EntityId=2 = Deal
  const terms = ['nascimento', 'aniversariante', 'criança', 'crianca', 'birthday']
  const seen = new Set<number>()
  const found: PloomesField[] = []

  for (const term of terms) {
    const res = await ploomesGet<ODataResponse<PloomesField>>(
      `Fields?$filter=EntityId eq 2 and contains(tolower(Name),'${term}')&$select=Id,Name,Key,TypeId,OptionsTableId&$top=50`,
      userKey,
    )
    for (const f of res.value ?? []) {
      if (!seen.has(f.Id)) { seen.add(f.Id); found.push(f) }
    }
    await new Promise((r) => setTimeout(r, 300))
  }

  if (found.length === 0) {
    console.log('Nenhum campo com esses termos. Listando TODOS os campos do Deal para referência:')
    const all = await ploomesGet<ODataResponse<PloomesField>>(
      'Fields?$filter=EntityId eq 2&$select=Id,Name,Key,TypeId&$top=200',
      userKey,
    )
    for (const f of all.value ?? []) {
      console.log(`  Id=${f.Id} TypeId=${f.TypeId} Name="${f.Name}" Key="${f.Key}"`)
    }
    return
  }

  console.log(`Candidatos encontrados (${found.length}):\n`)
  for (const f of found) {
    const typeLabel: Record<number, string> = { 1:'Text', 4:'Date', 5:'DateTime', 7:'Select', 8:'User', 10:'Bool', 11:'Number', 14:'Textarea' }
    console.log(`  Id         : ${f.Id}`)
    console.log(`  Name       : "${f.Name}"`)
    console.log(`  Key        : "${f.Key}"`)
    console.log(`  TypeId     : ${f.TypeId} (${typeLabel[f.TypeId] ?? 'Desconhecido'})`)
    console.log(`  OptionsTableId: ${f.OptionsTableId ?? '(nenhuma)'}`)
    console.log()
  }

  // Confirma a FieldKey que já temos no DEAL_FIELD_MAP
  const knownKey = 'deal_13506031-C53E-48A0-A92B-686F76AC77ED'
  console.log('=== CONFIRMAÇÃO: FieldKey já presente no field-mapping.ts ===')
  console.log(`Key: "${knownKey}"`)
  console.log(`Label no código: "Data de Nascimento"`)

  const match = found.find((f) => f.Key === knownKey)
  if (match) {
    console.log(`✅ CONFIRMADO — API Ploomes retornou esse campo: Name="${match.Name}"`)
  } else {
    console.log(`⚠️  Não apareceu nos resultados filtrados acima.`)
    console.log(`    Verificando diretamente via Id...`)
    // Tenta puxar 5 deals ganhos pra ver se o campo aparece no OtherProperties
    const dealsRes = await ploomesGet<ODataResponse<{ Id: number; OtherProperties: Array<{ FieldKey: string; DateTimeValue?: string }> }>>(
      `Deals?$filter=StatusId eq 2&$expand=OtherProperties($select=FieldKey,DateTimeValue)&$select=Id&$top=10&$orderby=LastUpdateDate desc`,
      userKey,
    )
    const deals = dealsRes.value ?? []
    console.log(`\n=== AMOSTRA: OtherProperties de 10 deals ganhos recentes ===`)
    let countWithBirthday = 0
    for (const d of deals) {
      const birthProp = d.OtherProperties?.find((p) => p.FieldKey === knownKey)
      if (birthProp?.DateTimeValue) {
        countWithBirthday++
        console.log(`  Deal ${d.Id}: birthdayDate = ${birthProp.DateTimeValue.slice(0, 10)}`)
      }
    }
    if (countWithBirthday === 0) {
      console.log(`  Nenhum dos 10 deals tem o campo "${knownKey}" preenchido nessa amostra.`)
    }
  }

  // Amostra de cobertura: 20 deals ganhos recentes
  console.log('\n=== COBERTURA: Amostra de 20 deals ganhos (status=2) ===')
  const sampleRes = await ploomesGet<ODataResponse<{ Id: number; OtherProperties: Array<{ FieldKey: string; DateTimeValue?: string }> }>>(
    `Deals?$filter=StatusId eq 2&$expand=OtherProperties($select=FieldKey,DateTimeValue)&$select=Id&$top=20&$orderby=LastUpdateDate desc`,
    userKey,
  )
  const sample = sampleRes.value ?? []
  const withBirthday = sample.filter((d) =>
    d.OtherProperties?.some((p) => p.FieldKey === knownKey && p.DateTimeValue)
  )
  console.log(`  Deals na amostra: ${sample.length}`)
  console.log(`  Com birthdayDate preenchido: ${withBirthday.length} (${Math.round(withBirthday.length / sample.length * 100)}%)`)
  if (withBirthday.length > 0) {
    console.log(`  Exemplos:`)
    for (const d of withBirthday.slice(0, 5)) {
      const prop = d.OtherProperties!.find((p) => p.FieldKey === knownKey)
      console.log(`    Deal ${d.Id}: ${prop!.DateTimeValue!.slice(0, 10)}`)
    }
  }
}

main().catch((err) => {
  console.error('[ERRO]', err)
  process.exit(1)
})
