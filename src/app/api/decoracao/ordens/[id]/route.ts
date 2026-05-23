import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import { DECORACAO_MANAGE_ROLES, DECORACAO_DELETE_ROLES } from '@/config/roles'
import type { DecoracaoOSItemFormInput } from '@/types/decoracao'

interface OSPatchBody {
  unit_id?: string
  data_festa?: string | null
  hora_festa?: string | null
  tema?: string
  tema_id?: string | null
  event_id?: string | null
  itens?: DecoracaoOSItemFormInput[]
}

/** Atualiza ordem + reconcilia itens (delete dos removidos, upsert dos enviados). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireRoleApi(DECORACAO_MANAGE_ROLES)
    if (!guard.ok) return guard.response

    const { id } = await params
    const body = (await request.json()) as OSPatchBody
    const tema = body.tema?.trim()

    if (!body.unit_id) {
      return NextResponse.json({ error: 'Unidade é obrigatória.' }, { status: 400 })
    }
    if (!tema) {
      return NextResponse.json({ error: 'Tema é obrigatório.' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    const { error } = await supabase.rpc('update_decoracao_os_with_items', {
      p_os_id: id,
      p_unit_id: body.unit_id,
      p_data_festa: body.data_festa ?? null,
      p_hora_festa: body.hora_festa ?? null,
      p_tema: tema,
      p_tema_id: body.tema_id ?? null,
      p_itens: body.itens ?? [],
      p_event_id: body.event_id ?? null,
    })

    if (error) {
      if (error.code === '42501') {
        return NextResponse.json(
          { error: 'Ordem não encontrada ou sem permissão.' },
          { status: 403 },
        )
      }
      throw error
    }

    return NextResponse.json({ data: { id } })
  } catch (err) {
    console.error('[PATCH /api/decoracao/ordens/[id]]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

/** Exclui uma OS permanentemente — cascade apaga itens. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireRoleApi(DECORACAO_DELETE_ROLES)
    if (!guard.ok) return guard.response

    const { id } = await params

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    const { error } = await supabase.from('decoracao_os').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/decoracao/ordens/[id]]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
