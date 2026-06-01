import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePermissionApi } from '@/lib/auth/require-permission'

interface VincularBody {
  event_id?: string
  tema_id?: string
}

/**
 * Vincula um tema a uma festa (evento) e PUXA a receita do tema como
 * lista da festa (snapshot). Re-vincular substitui a lista.
 *
 * RBAC dourado (Bloco C): guard por permissão 'decoracao'.'create'
 * (vincular cria a decoração da festa). A RLS INVOKER do RPC ainda
 * faz o lock fino por operação (parent INSERT='create'/UPDATE='edit',
 * itens='edit').
 */
export async function POST(request: Request) {
  try {
    const guard = await requirePermissionApi('decoracao', 'create')
    if (!guard.ok) return guard.response

    const body = (await request.json()) as VincularBody
    const eventId = typeof body.event_id === 'string' ? body.event_id.trim() : ''
    const temaId = typeof body.tema_id === 'string' ? body.tema_id.trim() : ''

    if (!eventId) {
      return NextResponse.json({ error: 'Evento é obrigatório.' }, { status: 400 })
    }
    if (!temaId) {
      return NextResponse.json({ error: 'Selecione um tema.' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    // Guard de integridade (Bloco D): re-vincular re-snapshota os itens
    // (reset 0/0/0/0). Numa festa encerrada isso seria um "reabrir"
    // disfarçado — bloqueia. Não há decoração ainda → segue (primeiro vínculo).
    const { data: existente, error: lookupErr } = await supabase
      .from('decoracao_festa')
      .select('status')
      .eq('event_id', eventId)
      .maybeSingle()
    if (lookupErr) throw lookupErr
    if (existente?.status === 'encerrada') {
      return NextResponse.json(
        { error: 'A decoração desta festa já foi encerrada e não pode ser revinculada.' },
        { status: 409 },
      )
    }

    const { data: festaId, error } = await supabase.rpc('vincular_tema_festa', {
      p_event_id: eventId,
      p_tema_id: temaId,
    })
    if (error) throw error

    return NextResponse.json({ ok: true, id: festaId })
  } catch (err) {
    console.error('[POST /api/decoracao/festa/vincular]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
