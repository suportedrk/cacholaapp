import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import { DECORACAO_MANAGE_ROLES } from '@/config/roles'
import type { UpsertSaldoInput } from '@/hooks/use-decoracao-estoque'

/**
 * PUT /api/decoracao/estoque
 * Upsert de saldo: INSERT (variacao_id, local_id, quantidade)
 * ON CONFLICT (variacao_id, local_id) DO UPDATE SET quantidade, updated_at.
 */
export async function PUT(request: Request) {
  try {
    const guard = await requireRoleApi(DECORACAO_MANAGE_ROLES)
    if (!guard.ok) return guard.response

    const body = (await request.json()) as Partial<UpsertSaldoInput>
    const { variacao_id, local_id, quantidade } = body

    if (!variacao_id || !local_id) {
      return NextResponse.json({ error: 'variacao_id e local_id são obrigatórios.' }, { status: 400 })
    }
    if (typeof quantidade !== 'number' || !Number.isInteger(quantidade) || quantidade < 0) {
      return NextResponse.json({ error: 'quantidade deve ser um inteiro ≥ 0.' }, { status: 400 })
    }

    const supabase = await createClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('decoracao_estoque_saldo')
      .upsert(
        { variacao_id, local_id, quantidade },
        { onConflict: 'variacao_id,local_id' },
      )
      .select()
      .single()

    if (error) {
      if (error.code === '42501') {
        return NextResponse.json({ error: 'Sem permissão para ajustar o estoque.' }, { status: 403 })
      }
      if (error.code === '23503') {
        return NextResponse.json({ error: 'Variação ou local não encontrado.' }, { status: 400 })
      }
      if (error.code === '23514') {
        return NextResponse.json({ error: 'Quantidade não pode ser negativa.' }, { status: 400 })
      }
      throw error
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[PUT /api/decoracao/estoque]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
