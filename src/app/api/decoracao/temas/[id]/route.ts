import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import { DECORACAO_MANAGE_ROLES, DECORACAO_DELETE_ROLES } from '@/config/roles'

interface TemaBody {
  nome?: string
  categoria?: string | null
  ativo?: boolean
  observacoes?: string | null
  personalizado?: boolean
  decoradora_externa?: boolean
  forminha_cor_ids?: string[]
}

/** Edita um tema e substitui o conjunto de cores de forminha vinculadas. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireRoleApi(DECORACAO_MANAGE_ROLES)
    if (!guard.ok) return guard.response

    const { id } = await params
    const body = (await request.json()) as TemaBody
    const nome = body.nome?.trim()

    if (!nome) {
      return NextResponse.json({ error: 'Nome do tema é obrigatório.' }, { status: 400 })
    }

    const forminhaIds = Array.isArray(body.forminha_cor_ids)
      ? body.forminha_cor_ids.filter((v) => typeof v === 'string')
      : []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createAdminClient()) as any

    const { data: tema, error } = await supabase
      .from('decoracao_temas')
      .update({
        nome,
        categoria: body.categoria?.trim() || null,
        ativo: body.ativo ?? true,
        observacoes: body.observacoes?.trim() || null,
        personalizado: body.personalizado ?? false,
        decoradora_externa: body.decoradora_externa ?? false,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    if (!tema) {
      return NextResponse.json({ error: 'Tema não encontrado.' }, { status: 404 })
    }

    // Substitui o conjunto de vínculos: remove todos e reinsere o novo conjunto.
    const { error: delErr } = await supabase
      .from('decoracao_tema_forminhas')
      .delete()
      .eq('tema_id', id)
    if (delErr) throw delErr

    if (forminhaIds.length > 0) {
      const { error: linkErr } = await supabase
        .from('decoracao_tema_forminhas')
        .insert(forminhaIds.map((fid) => ({ tema_id: id, forminha_cor_id: fid })))
      if (linkErr) throw linkErr
    }

    return NextResponse.json({ data: tema })
  } catch (err) {
    console.error('[PATCH /api/decoracao/temas/[id]]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

/** Exclui um tema de forma permanente (cascateia os vínculos). */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireRoleApi(DECORACAO_DELETE_ROLES)
    if (!guard.ok) return guard.response

    const { id } = await params

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createAdminClient()) as any

    const { error } = await supabase.from('decoracao_temas').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/decoracao/temas/[id]]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
