/**
 * Laboratório de Usuários de Teste — Cachola OS
 *
 * Cria 5 usuários com roles distintas para validação de guards e acesso.
 * Seguro para produção: emails exclusivos @cachola.cloud + idempotente.
 *
 * Uso: npx tsx scripts/seed-test-users.ts
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('[seed] NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PINHEIROS_UNIT_ID   = '36d3b2e5-42fd-4094-a726-258c0a643986'
const RAPHAELA_SELLER_ID  = '1b6c6505-5ec7-4778-8d18-d141ca01f148'
const TEST_PASSWORD       = 'Teste@2026cacholaos!'

const TEST_USERS = [
  { email: 'teste-superadmin@cachola.cloud',  name: 'Teste SuperAdmin',  role: 'super_admin' },
  { email: 'teste-diretor@cachola.cloud',     name: 'Teste Diretor',     role: 'diretor'     },
  { email: 'teste-gerente@cachola.cloud',     name: 'Teste Gerente',     role: 'gerente'     },
  { email: 'teste-financeiro@cachola.cloud',  name: 'Teste Financeiro',  role: 'financeiro'  },
  { email: 'teste-vendedora@cachola.cloud',   name: 'Teste Vendedora',   role: 'vendedora'   },
  { email: 'teste-rh@cachola.cloud',          name: 'Teste RH',          role: 'rh'          },
  { email: 'teste-manutencao@cachola.cloud',  name: 'Teste Manutenção',  role: 'manutencao'  },
  { email: 'teste-posvendas@cachola.cloud',   name: 'Teste Pós-Vendas',  role: 'pos_vendas'  },
  // Usuário local-only para testes no ambiente de desenvolvimento
  { email: 'vendedora.teste@cachola.local',   name: 'Vendedora Teste Local', role: 'vendedora' },
] as const

async function seedUser(email: string, name: string, role: string): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password:       TEST_PASSWORD,
    email_confirm:  true,
    user_metadata:  { name, role },
  })

  if (error) {
    if (error.message.toLowerCase().includes('already registered') ||
        error.message.toLowerCase().includes('already been registered') ||
        error.message.toLowerCase().includes('already exists')) {
      console.log(`[seed] SKIP  ${email} — já existe`)
      // Busca o id existente para retornar
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single()
      return existing?.id ?? null
    }
    console.error(`[seed] ERRO  ${email}:`, error.message)
    return null
  }

  console.log(`[seed] OK    ${email} — id=${data.user.id}`)
  return data.user.id
}

async function linkVendedoraSeller(userId: string) {
  const { error } = await supabase
    .from('users')
    .update({ seller_id: RAPHAELA_SELLER_ID })
    .eq('id', userId)

  if (error) {
    console.error(`[seed] ERRO  seller_id link para ${userId}:`, error.message)
  } else {
    console.log(`[seed]   → seller_id vinculado (Raphaela Melo)`)
  }
}

async function linkGerenteUnit(userId: string) {
  const { error } = await supabase
    .from('user_units')
    .upsert(
      { user_id: userId, unit_id: PINHEIROS_UNIT_ID, role: 'gerente', is_default: true },
      { onConflict: 'user_id,unit_id', ignoreDuplicates: true },
    )

  if (error) {
    console.error(`[seed] ERRO  user_units insert para ${userId}:`, error.message)
  } else {
    console.log(`[seed]   → user_units linkado (Pinheiros / gerente)`)
  }
}

async function main() {
  console.log('[seed] Iniciando laboratório de usuários de teste...')
  console.log(`[seed] Supabase: ${SUPABASE_URL}`)
  console.log()

  for (const { email, name, role } of TEST_USERS) {
    const userId = await seedUser(email, name, role)
    if (!userId) continue

    if (role === 'vendedora') await linkVendedoraSeller(userId)
    if (role === 'gerente')   await linkGerenteUnit(userId)
  }

  console.log()
  console.log('[seed] Validando...')

  const { data: rows, error: selErr } = await supabase
    .from('users')
    .select('email, role, seller_id')
    .like('email', 'teste-%@cachola.cloud')
    .order('role')

  if (selErr) {
    console.error('[seed] Erro ao validar:', selErr.message)
    return
  }

  console.table(rows)
  console.log(`[seed] ${rows?.length ?? 0}/8 usuários presentes.`)

  if ((rows?.length ?? 0) < 8) {
    console.warn('[seed] ATENÇÃO: menos de 8 usuários encontrados!')
    process.exit(1)
  }

  console.log('[seed] Laboratório pronto.')
}

main().catch((e) => { console.error('[seed] Fatal:', e); process.exit(1) })
