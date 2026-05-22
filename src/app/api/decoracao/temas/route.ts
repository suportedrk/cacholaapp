import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import { DECORACAO_MANAGE_ROLES } from '@/config/roles'

interface TemaBody {
  nome?: string
  categoria?: string | null
  ativo?: boolean
  observacoes?: string | null
  personalizado?: boolean
  decoradora_externa?: boolean
  forminha_cor_ids?: string[]
}

/** Cria um tema de decoração e seus vínculos com cores de forminha. */
export async function POST(request: Request) {
  try {
    const guard = await requireRoleApi(DECORACAO_MANAGE_ROLES)
    if (!guard.ok) return guard.response

    const body = (await request.json()) as TemaBody
    const nome = body.nome?.trim()

    if (!nome) {
      return NextResponse.json({ error: 'Nome do tema é obrigatório.' }, { status: 400 })
    }

    const forminhaIds = Array.isArray(body.forminha_cor_ids)
      ? body.forminha_cor_ids.filter((v) => typeof v === 'string')
      : []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    const { data: tema, error } = await supabase
      .from('decoracao_temas')
      .insert({
        nome,
        categoria: body.categoria?.trim() || null,
        ativo: body.ativo ?? true,
        observacoes: body.observacoes?.trim() || null,
        personalizado: body.personalizado ?? false,
        decoradora_externa: body.decoradora_externa ?? false,
      })
      .select()
      .single()

    if (error) throw error

    if (forminhaIds.length > 0) {
      const { error: linkErr } = await supabase
        .from('decoracao_tema_forminhas')
        .insert(forminhaIds.map((fid) => ({ tema_id: tema.id, forminha_cor_id: fid })))
      if (linkErr) throw linkErr
    }

    return NextResponse.json({ data: tema })
  } catch (err) {
    console.error('[POST /api/decoracao/temas]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
