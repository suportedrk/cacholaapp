/**
 * Laboratório de Usuários de Teste — Cleanup
 *
 * Remove todos os usuários teste-*@cachola.cloud do Supabase Auth + public.users.
 * CASCADE automático: user_units e user_permissions são deletados pelo Postgres.
 * sellers NÃO são afetados (ON DELETE SET NULL).
 *
 * Uso: npx tsx scripts/cleanup-test-users.ts
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('[cleanup] NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const ALLOWED_PREFIX = 'teste-'
const ALLOWED_DOMAIN = '@cachola.cloud'

async function main() {
  console.log('[cleanup] Buscando usuários de teste...')

  const { data: rows, error } = await supabase
    .from('users')
    .select('id, email, role')
    .like('email', `${ALLOWED_PREFIX}%${ALLOWED_DOMAIN}`)
    .order('email')

  if (error) {
    console.error('[cleanup] Erro ao buscar usuários:', error.message)
    process.exit(1)
  }

  if (!rows || rows.length === 0) {
    console.log('[cleanup] Nenhum usuário de teste encontrado. Nada a fazer.')
    return
  }

  // Dupla checagem: garante que nenhum email inesperado escorregou pelo LIKE
  const suspicious = rows.filter(
    (u) => !u.email.startsWith(ALLOWED_PREFIX) || !u.email.endsWith(ALLOWED_DOMAIN),
  )

  if (suspicious.length > 0) {
    console.error('[cleanup] ABORTANDO — emails suspeitos detectados:')
    suspicious.forEach((u) => console.error('  ', u.email))
    process.exit(1)
  }

  console.log(`[cleanup] Encontrados ${rows.length} usuários para remover:`)
  rows.forEach((u) => console.log(`  ${u.email} (${u.role})`))
  console.log()

  let removed = 0
  for (const user of rows) {
    const { error: delErr } = await supabase.auth.admin.deleteUser(user.id)
    if (delErr) {
      console.error(`[cleanup] ERRO  ${user.email}:`, delErr.message)
    } else {
      console.log(`[cleanup] OK    ${user.email} removido`)
      removed++
    }
  }

  console.log()
  console.log(`[cleanup] ${removed}/${rows.length} usuários removidos.`)

  // Confirmação final
  const { data: remaining } = await supabase
    .from('users')
    .select('email')
    .like('email', `${ALLOWED_PREFIX}%${ALLOWED_DOMAIN}`)

  if (remaining && remaining.length > 0) {
    console.warn('[cleanup] ATENÇÃO: ainda existem usuários de teste:', remaining.map((r) => r.email))
    process.exit(1)
  }

  console.log('[cleanup] Laboratório limpo.')
}

main().catch((e) => { console.error('[cleanup] Fatal:', e); process.exit(1) })
