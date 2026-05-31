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
