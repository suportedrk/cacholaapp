#!/usr/bin/env tsx
// =============================================================
// Discover: FieldKey do campo "Cliente Cachola ?" em Contacts
// =============================================================
// Uso: npx tsx scripts/discover-cliente-cachola-fieldkey.ts
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

interface PloomesOption {
  Id: number
  Name: string
}

interface PloomesOptionsTable {
  Options?: PloomesOption[]
}

interface ODataResponse<T> {
  value: T[]
}

async function getUserKey(): Promise<string> {
  // Tenta ler do banco, cai no env var
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

  // EntityId=1 = Contact, EntityId=2 = Deal
  // Busca campos cujo Name contém "Cliente"
  const fieldsUrl = `Fields?$filter=EntityId eq 1 and contains(Name,'Cliente')&$select=Id,Name,Key,TypeId,OptionsTableId&$top=50`

  const res = await ploomesGet<ODataResponse<PloomesField>>(fieldsUrl, userKey)
  const fields = res.value ?? []

  if (fields.length === 0) {
    console.warn('Nenhum campo encontrado em Contact com "Cliente" no nome.')
    console.log('Tentando busca ampla (todos os campos custom do Contact)...')
    const allRes = await ploomesGet<ODataResponse<PloomesField>>(
      'Fields?$filter=EntityId eq 1&$select=Id,Name,Key,TypeId,OptionsTableId&$top=100',
      userKey,
    )
    const all = allRes.value ?? []
    console.log(`Total campos Contact: ${all.length}`)
    all.forEach((f) => console.log(`  Id=${f.Id} Name="${f.Name}" Key="${f.Key}" TypeId=${f.TypeId} OptionsTableId=${f.OptionsTableId ?? '-'}`))
    return
  }

  console.log(`Campos encontrados (${fields.length}):`)
  for (const f of fields) {
    console.log(`\n  Id=${f.Id}`)
    console.log(`  Name="${f.Name}"`)
    console.log(`  Key="${f.Key}"`)
    console.log(`  TypeId=${f.TypeId}`)
    console.log(`  OptionsTableId=${f.OptionsTableId ?? '(nenhuma)'}`)

    if (f.OptionsTableId) {
      const tableRes = await ploomesGet<PloomesOptionsTable>(
        `OptionsTables(${f.OptionsTableId})?$expand=Options($select=Id,Name)`,
        userKey,
      )
      const opts = tableRes.Options ?? []
      console.log(`  Opções (${opts.length}):`)
      opts.forEach((o) => console.log(`    - Id=${o.Id} Name="${o.Name}"`))

      const simOpt = opts.find((o) => o.Name.toLowerCase().includes('sim') || o.Name === 'Sim')
      if (simOpt) {
        console.log(`\n  *** RESULTADO ***`)
        console.log(`  FieldKey (para filtro OData): "${f.Key}"`)
        console.log(`  OptionsTableId: ${f.OptionsTableId}`)
        console.log(`  Option "Sim" Id: ${simOpt.Id}`)
      }
    }
  }
}

main().catch((err) => {
  console.error('[ERRO]', err)
  process.exit(1)
})
