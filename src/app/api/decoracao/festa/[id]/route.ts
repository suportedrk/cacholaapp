import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePermissionApi } from '@/lib/auth/require-permission'
import { sanitizeReceita } from '../../temas/receita-utils'

interface FestaItemBody {
  variacao_id?: string
  quantidade?: number
  ordem?: number
}

interface FestaPatchBody {
  itens?: FestaItemBody[]
  foto_path?: string | null
  observacoes?: string | null
}

/**
 * Edita a decoração da festa: lista de itens (reconcilia via RPC),
 * foto override e/ou observações. Patch parcial — só os campos
 * presentes no body são tocados.
 *
 * RBAC dourado (Bloco C): guard por 'decoracao'.'edit'.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requirePermissionApi('decoracao', 'edit')
    if (!guard.ok) return guard.response

    const { id } = await params
    const body = (await request.json()) as FestaPatchBody

    const updateItens = 'itens' in body
    const patch: Record<string, unknown> = {}
    if ('foto_path' in body) patch.foto_path = body.foto_path ?? null
    if ('observacoes' in body) patch.observacoes = body.observacoes?.trim() || null

    if (Object.keys(patch).length === 0 && !updateItens) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar.' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    // Guard de integridade (Bloco D): festa encerrada é read-only. Sem isto,
    // o resumo read-only da UI seria burlável via API.
    const { data: festa, error: festaErr } = await supabase
      .from('decoracao_festa')
      .select('status')
      .eq('id', id)
      .maybeSingle()
    if (festaErr) throw festaErr
    if (!festa) {
      return NextResponse.json({ error: 'Decoração não encontrada.' }, { status: 404 })
    }
    if (festa.status === 'encerrada') {
      return NextResponse.json(
        { error: 'Esta decoração já foi encerrada e não pode mais ser editada.' },
        { status: 409 },
      )
    }

    if (Object.keys(patch).length > 0) {
      const { data: row, error } = await supabase
        .from('decoracao_festa')
        .update(patch)
        .eq('id', id)
        .select('id')
        .single()
      if (error) throw error
      if (!row) {
        return NextResponse.json({ error: 'Decoração não encontrada.' }, { status: 404 })
      }
    }

    // Itens por último — gravação atômica via RPC (reconcilia numa transação).
    if (updateItens) {
      const itens = sanitizeReceita(body.itens)
      const { error: itensErr } = await supabase.rpc('update_festa_decoracao_itens', {
        p_festa_decoracao_id: id,
        p_itens: itens,
      })
      if (itensErr) throw itensErr
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/decoracao/festa/[id]]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

/** Remove a decoração inteira da festa (desvincular). Cascateia os itens. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requirePermissionApi('decoracao', 'delete')
    if (!guard.ok) return guard.response

    const { id } = await params

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    const { error } = await supabase.from('decoracao_festa').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/decoracao/festa/[id]]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
