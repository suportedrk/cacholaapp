import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePermissionApi } from '@/lib/auth/require-permission'

interface ResolverBody {
  resolucao?: string
  local_id?: string | null
}

/**
 * Resolve uma linha de quarentena. 'consertado' devolve a quantidade ao
 * saldo do local (p_local_id obrigatório); 'descartado' apenas encerra a
 * linha (o saldo segue baixado). A operação atômica fica no RPC.
 *
 * RBAC dourado (Bloco D): guard por 'decoracao'.'edit' (resolver = operar
 * a decoração).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requirePermissionApi('decoracao', 'edit')
    if (!guard.ok) return guard.response

    const { id } = await params
    const body = (await request.json()) as ResolverBody

    const resolucao = body.resolucao === 'consertado' || body.resolucao === 'descartado'
      ? body.resolucao
      : null
    if (!resolucao) {
      return NextResponse.json(
        { error: 'Resolução inválida (use consertado ou descartado).' },
        { status: 400 },
      )
    }

    const localId =
      typeof body.local_id === 'string' && body.local_id.trim()
        ? body.local_id.trim()
        : null
    if (resolucao === 'consertado' && !localId) {
      return NextResponse.json(
        { error: 'Selecione o local para devolver ao estoque.' },
        { status: 400 },
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    const { error } = await supabase.rpc('resolver_quarentena', {
      p_quarentena_id: id,
      p_resolucao: resolucao,
      p_local_id: localId,
    })
    if (error) {
      const msg = String(error.message ?? '')
      if (msg.includes('quarentena_ja_resolvida')) {
        return NextResponse.json(
          { error: 'Esta linha de quarentena já foi resolvida.' },
          { status: 409 },
        )
      }
      throw error
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/decoracao/quarentena/[id]/resolver]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
