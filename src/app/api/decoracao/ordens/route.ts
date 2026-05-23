import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import { DECORACAO_MANAGE_ROLES } from '@/config/roles'
import type { DecoracaoOSItemFormInput } from '@/types/decoracao'

interface OSBody {
  unit_id?: string
  data_festa?: string | null
  hora_festa?: string | null
  tema?: string
  tema_id?: string | null
  itens?: DecoracaoOSItemFormInput[]
}

/** Cria uma ordem de serviço de decoração + seus itens, em uma transação atômica via RPC. */
export async function POST(request: Request) {
  try {
    const guard = await requireRoleApi(DECORACAO_MANAGE_ROLES)
    if (!guard.ok) return guard.response

    const body = (await request.json()) as OSBody
    const tema = body.tema?.trim()

    if (!body.unit_id) {
      return NextResponse.json({ error: 'Unidade é obrigatória.' }, { status: 400 })
    }
    if (!tema) {
      return NextResponse.json({ error: 'Tema é obrigatório.' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    const { data, error } = await supabase.rpc('create_decoracao_os_with_items', {
      p_unit_id: body.unit_id,
      p_data_festa: body.data_festa ?? null,
      p_hora_festa: body.hora_festa ?? null,
      p_tema: tema,
      p_tema_id: body.tema_id ?? null,
      p_itens: body.itens ?? [],
    })

    if (error) {
      if (error.code === '42501') {
        return NextResponse.json(
          { error: 'Sem permissão para criar ordem nesta unidade.' },
          { status: 403 },
        )
      }
      throw error
    }

    return NextResponse.json({ data: { id: data } })
  } catch (err) {
    console.error('[POST /api/decoracao/ordens]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
