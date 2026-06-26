#!/usr/bin/env tsx
// =============================================================
// Backfill: checklist_items.photo_url  (URL pública legada → PATH)
// =============================================================
// Contexto: a migration 169 tornou o bucket `checklist-photos` PRIVADO. O app
// passou a gravar o PATH em photo_url e a exibir via signed URL. Linhas antigas
// ainda guardam a URL pública completa
//   (https://.../object/public/checklist-photos/<path>).
// Este script converte essas linhas para apenas <path>. Idempotente: linhas que
// já são path (não começam com http) são ignoradas.
//
// Uso:
//   npx tsx scripts/backfill-checklist-photo-paths.ts --dry-run   # só conta
//   npx tsx scripts/backfill-checklist-photo-paths.ts             # aplica
//
// Em PRODUÇÃO (o .env não tem as chaves Supabase — estão no .env.local):
//   DOTENV_CONFIG_PATH=.env.local npx tsx scripts/backfill-checklist-photo-paths.ts --dry-run
//   DOTENV_CONFIG_PATH=.env.local npx tsx scripts/backfill-checklist-photo-paths.ts
//
// Pré-requisitos: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// =============================================================

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no ambiente.')
  process.exit(1)
}

const MARKER = '/checklist-photos/'

/** URL pública (ou path) → path. Mesmo critério de src/lib/utils/storage-path.ts. */
function toPath(value: string): string {
  const idx = value.indexOf(MARKER)
  return idx >= 0 ? value.slice(idx + MARKER.length) : value
}

async function main() {
  const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false },
  })

  // Só as linhas que ainda guardam URL (começam com http). Path puro é ignorado.
  const { data, error } = await supabase
    .from('checklist_items')
    .select('id, photo_url')
    .like('photo_url', 'http%')

  if (error) {
    console.error('❌ Erro ao buscar itens:', error.message)
    process.exit(1)
  }

  const rows = data ?? []
  console.log(`🔎 ${rows.length} item(ns) com photo_url em formato de URL pública.`)

  if (rows.length === 0) {
    console.log('✅ Nada a fazer (todas as fotos já estão em path).')
    return
  }

  let updated = 0
  let skipped = 0
  for (const row of rows) {
    const url = row.photo_url as string
    const path = toPath(url)
    if (path === url || path.length === 0) {
      // Sem o marcador esperado — não mexe (evita corromper valor inesperado).
      console.warn(`⚠️  pulado (sem '${MARKER}'): item ${row.id} → ${url.slice(0, 80)}`)
      skipped++
      continue
    }
    if (DRY_RUN) {
      console.log(`   [dry-run] ${row.id}: ${url.slice(0, 60)}… → ${path}`)
      updated++
      continue
    }
    const { error: updErr } = await supabase
      .from('checklist_items')
      .update({ photo_url: path })
      .eq('id', row.id)
    if (updErr) {
      console.error(`❌ falha ao atualizar item ${row.id}:`, updErr.message)
      skipped++
    } else {
      updated++
    }
  }

  console.log(
    `\n${DRY_RUN ? '🟡 DRY-RUN' : '✅ APLICADO'} — ${updated} convertido(s), ${skipped} pulado(s).`,
  )
}

main().catch((e) => {
  console.error('❌ Erro inesperado:', e)
  process.exit(1)
})
