import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { ploomesGet } from './client'
import { loadPloomesConfig } from './sync'

type AdminClient = SupabaseClient<Database>

interface PloomesUser {
  Id: number
  Name: string
  Email?: string
  Suspended: boolean
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface SyncSellersResult {
  found: number
  created: number
  updated: number
}

/**
 * Sincroniza usuários ativos do Ploomes com a tabela local `sellers`.
 *
 * Campos protegidos nunca alterados em conflito:
 *   status, is_system_account, primary_unit_id, notes, hire_date, termination_date
 *
 * Em conflito (owner_id já existe):
 *   - name: sempre atualizado
 *   - email: atualizado apenas se o valor atual no banco for null
 */
export async function syncSellersFromPloomes(
  supabase: AdminClient,
): Promise<SyncSellersResult> {
  // 1. Resolver User-Key
  const config = await loadPloomesConfig(supabase, null)
  const userKey = config?.user_key || process.env.PLOOMES_USER_KEY || ''
  if (!userKey) {
    throw new Error(
      'Chave de API do Ploomes não configurada. Acesse Configurações → Integrações → Ploomes.',
    )
  }

  // 2. Buscar todos os usuários (paginado), filtrar ativos em JS
  const allActive: PloomesUser[] = []
  let skip = 0
  const top = 100

  while (true) {
    const path = `Users?$top=${top}&$skip=${skip}`
    const page = await ploomesGet<PloomesUser>(path, userKey)
    const items = page.value ?? []

    for (const u of items) {
      if (u.Suspended === false) allActive.push(u)
    }

    if (items.length < top) break
    skip += top
    await sleep(600)
  }

  if (allActive.length === 0) {
    return { found: 0, created: 0, updated: 0 }
  }

  // 3. Carregar vendedoras existentes (owner_id + email atual)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: selectError } = await (supabase as any)
    .from('sellers')
    .select('owner_id, email')

  if (selectError) {
    throw new Error(`Erro ao consultar vendedoras: ${selectError.message}`)
  }

  const existingMap = new Map<number, { email: string | null }>(
    (existing ?? []).map((s: { owner_id: number; email: string | null }) => [
      s.owner_id,
      { email: s.email },
    ]),
  )

  // 4. Particionar em novos vs existentes
  const toInsert = allActive.filter((u) => !existingMap.has(u.Id))
  const toUpdate = allActive.filter((u) => existingMap.has(u.Id))

  // 5. Inserir novos (upsert com ignoreDuplicates para proteger de race com trigger)
  if (toInsert.length > 0) {
    const rows = toInsert.map((u) => ({
      owner_id: u.Id,
      name: u.Name,
      status: 'active' as const,
      ...(u.Email ? { email: u.Email } : {}),
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase as any)
      .from('sellers')
      .upsert(rows, { onConflict: 'owner_id', ignoreDuplicates: true })

    if (insertError) {
      throw new Error(`Erro ao inserir vendedoras: ${insertError.message}`)
    }
  }

  // 6. Atualizar existentes: name sempre; email só se null no banco
  let updated = 0
  for (const user of toUpdate) {
    const current = existingMap.get(user.Id)!
    const payload: { name: string; email?: string } = { name: user.Name }
    if (!current.email && user.Email) {
      payload.email = user.Email
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('sellers')
      .update(payload)
      .eq('owner_id', user.Id)

    if (updateError) {
      console.error(
        `[syncSellersFromPloomes] Falha ao atualizar owner_id=${user.Id}:`,
        updateError.message,
      )
    } else {
      updated++
    }
  }

  return {
    found: allActive.length,
    created: toInsert.length,
    updated,
  }
}
