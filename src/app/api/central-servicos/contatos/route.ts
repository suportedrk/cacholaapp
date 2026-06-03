import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth/require-permission'
import { createClient } from '@/lib/supabase/server'
import { CONTATO_UNIDADES, type ContatoFormInput } from '@/types/central-servicos'

/**
 * POST /api/central-servicos/contatos — cria um contato.
 * Guard: check_permission('central_servicos', 'create'). A RLS reforça no banco.
 */
export async function POST(request: Request) {
  try {
    const guard = await requirePermissionApi('central_servicos', 'create')
    if (!guard.ok) return guard.response

    const body = (await request.json()) as ContatoFormInput
    const nome = body.nome?.trim()

    if (!nome) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 })
    if (!CONTATO_UNIDADES.includes(body.unidade)) {
      return NextResponse.json({ error: 'Unidade inválida.' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    const { data: userRes } = await supabase.auth.getUser()
    const created_by = userRes?.user?.id ?? null

    const { data: maxRow } = await supabase
      .from('central_servicos_contatos')
      .select('ordem')
      .order('ordem', { ascending: false })
      .limit(1)
      .maybeSingle()

    const ordem = maxRow ? (maxRow.ordem as number) + 1 : 0

    const { data, error } = await supabase
      .from('central_servicos_contatos')
      .insert({
        nome,
        setor: body.setor?.trim() || null,
        cargo: body.cargo?.trim() || null,
        unidade: body.unidade,
        email: body.email?.trim() || null,
        telefone: body.telefone?.trim() || null,
        foto_path: body.foto_path?.trim() || null,
        ativo: body.ativo ?? true,
        ordem,
        created_by,
      })
      .select('id')
      .single()

    if (error) throw error
    return NextResponse.json({ data: { id: data.id } })
  } catch (err) {
    console.error('[POST /api/central-servicos/contatos]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
