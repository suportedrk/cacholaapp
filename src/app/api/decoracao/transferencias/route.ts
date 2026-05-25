import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import { DECORACAO_MANAGE_ROLES } from '@/config/roles'
import type { CriarTransferenciaInput } from '@/types/decoracao'

/**
 * POST /api/decoracao/transferencias
 * Cria uma transferência (status='em_transito').
 * Chama RPC criar_transferencia → decrementa saldo da origem atomicamente.
 */
export async function POST(request: Request) {
  try {
    const guard = await requireRoleApi(DECORACAO_MANAGE_ROLES)
    if (!guard.ok) return guard.response

    const body = (await request.json()) as Partial<CriarTransferenciaInput>
    const { origem_local_id, destino_local_id, observacoes, itens } = body

    if (!origem_local_id || !destino_local_id) {
      return NextResponse.json(
        { error: 'Origem e destino são obrigatórios.' },
        { status: 400 },
      )
    }
    if (origem_local_id === destino_local_id) {
      return NextResponse.json(
        { error: 'Origem e destino devem ser diferentes.' },
        { status: 400 },
      )
    }
    if (!Array.isArray(itens) || itens.length === 0) {
      return NextResponse.json(
        { error: 'Inclua ao menos um item na transferência.' },
        { status: 400 },
      )
    }
    for (const item of itens) {
      if (
        !item.variacao_id ||
        typeof item.quantidade !== 'number' ||
        !Number.isInteger(item.quantidade) ||
        item.quantidade <= 0
      ) {
        return NextResponse.json(
          { error: 'Cada item precisa de variacao_id e quantidade > 0.' },
          { status: 400 },
        )
      }
    }

    const supabase = await createClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('criar_transferencia', {
      p_origem: origem_local_id,
      p_destino: destino_local_id,
      p_observacoes: observacoes ?? null,
      p_itens: itens,
    })

    if (error) {
      if (error.code === '42501') {
        return NextResponse.json(
          { error: 'Sem permissão para criar transferência.' },
          { status: 403 },
        )
      }
      // Regras do RPC (saldo insuficiente, origem=destino, item inválido, etc.)
      // chegam como P0001 com message útil.
      const message =
        typeof error.message === 'string' && error.message.length > 0
          ? error.message
          : 'Erro ao criar transferência.'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    return NextResponse.json({ id: data as string })
  } catch (err) {
    console.error('[POST /api/decoracao/transferencias]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
