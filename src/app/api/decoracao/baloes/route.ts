import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import { DECORACAO_MANAGE_ROLES } from '@/config/roles'

interface BalaoBody {
  nome?: string
  categoria?: string | null
  custo?: number | null
  valor_venda?: number | null
  ativo?: boolean
  observacoes?: string | null
  foto_url?: string | null
}

/** Cria um modelo de balão. */
export async function POST(request: Request) {
  try {
    const guard = await requireRoleApi(DECORACAO_MANAGE_ROLES)
    if (!guard.ok) return guard.response

    const body = (await request.json()) as BalaoBody
    const nome = body.nome?.trim()

    if (!nome) {
      return NextResponse.json({ error: 'Nome do modelo é obrigatório.' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    const { data, error } = await supabase
      .from('decoracao_balao_modelos')
      .insert({
        nome,
        categoria: body.categoria?.trim() || null,
        custo: body.custo ?? null,
        valor_venda: body.valor_venda ?? null,
        ativo: body.ativo ?? true,
        observacoes: body.observacoes?.trim() || null,
        foto_url: body.foto_url ?? null,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: `Já existe um modelo com este nome.` }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[POST /api/decoracao/baloes]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
