import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePermissionApi } from '@/lib/auth/require-permission'

interface EncerrarItemBody {
  variacao_id?: string
  qtd_ok?: number
  qtd_quebrado?: number
  qtd_perdido?: number
  qtd_quarentena?: number
  motivo?: string | null
}

interface EncerrarBody {
  local_id?: string
  itens?: EncerrarItemBody[]
}

function intOrZero(v: unknown): number {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/**
 * Encerra a decoração da festa: grava os desfechos por item, dá baixa no
 * saldo do local escolhido (GREATEST(0,…)) e gera as linhas de quarentena.
 * A validação de soma=quantidade por linha e a baixa atômica ficam no RPC.
 *
 * RBAC dourado (Bloco D): guard por 'decoracao'.'edit' (encerrar = operar
 * a decoração). A RLS INVOKER do RPC ainda faz o lock fino por tabela.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requirePermissionApi('decoracao', 'edit')
    if (!guard.ok) return guard.response

    const { id } = await params
    const body = (await request.json()) as EncerrarBody

    const localId = typeof body.local_id === 'string' ? body.local_id.trim() : ''
    if (!localId) {
      return NextResponse.json(
        { error: 'Selecione o local da baixa de estoque.' },
        { status: 400 },
      )
    }

    // Sanitiza os desfechos informados (linhas omitidas → tudo OK no RPC).
    const itens = Array.isArray(body.itens)
      ? body.itens
          .filter((i) => typeof i.variacao_id === 'string' && i.variacao_id.trim())
          .map((i) => ({
            variacao_id: (i.variacao_id as string).trim(),
            qtd_ok: intOrZero(i.qtd_ok),
            qtd_quebrado: intOrZero(i.qtd_quebrado),
            qtd_perdido: intOrZero(i.qtd_perdido),
            qtd_quarentena: intOrZero(i.qtd_quarentena),
            motivo:
              typeof i.motivo === 'string' && i.motivo.trim() ? i.motivo.trim() : null,
          }))
      : []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    const { data, error } = await supabase.rpc('encerrar_festa_decoracao', {
      p_festa_decoracao_id: id,
      p_itens: itens,
      p_local_id: localId,
    })
    if (error) {
      // Mensagens amigáveis para as exceções de regra do RPC.
      const msg = String(error.message ?? '')
      if (msg.includes('festa_ja_encerrada')) {
        return NextResponse.json(
          { error: 'Esta decoração já foi encerrada.' },
          { status: 409 },
        )
      }
      if (msg.includes('soma_invalida')) {
        return NextResponse.json(
          { error: 'A soma dos desfechos de cada item precisa bater com a quantidade.' },
          { status: 400 },
        )
      }
      throw error
    }

    return NextResponse.json(data ?? { festa_id: id, avisos: [] })
  } catch (err) {
    console.error('[POST /api/decoracao/festa/[id]/encerrar]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
