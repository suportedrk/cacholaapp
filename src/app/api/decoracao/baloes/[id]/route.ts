import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import { DECORACAO_MANAGE_ROLES, DECORACAO_DELETE_ROLES } from '@/config/roles'

interface BalaoBody {
  nome?: string
  categoria?: string | null
  custo?: number | null
  valor_venda?: number | null
  ativo?: boolean
  observacoes?: string | null
}

/** Edita um modelo de balão. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireRoleApi(DECORACAO_MANAGE_ROLES)
    if (!guard.ok) return guard.response

    const { id } = await params
    const body = (await request.json()) as BalaoBody
    const nome = body.nome?.trim()

    if (!nome) {
      return NextResponse.json({ error: 'Nome do modelo é obrigatório.' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    const { data, error } = await supabase
      .from('decoracao_balao_modelos')
      .update({
        nome,
        categoria: body.categoria?.trim() || null,
        custo: body.custo ?? null,
        valor_venda: body.valor_venda ?? null,
        ativo: body.ativo ?? true,
        observacoes: body.observacoes?.trim() || null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: 'Modelo não encontrado.' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[PATCH /api/decoracao/baloes/[id]]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

/** Exclui um modelo de balão permanentemente. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireRoleApi(DECORACAO_DELETE_ROLES)
    if (!guard.ok) return guard.response

    const { id } = await params

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    const { error } = await supabase.from('decoracao_balao_modelos').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/decoracao/baloes/[id]]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
