import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth/require-permission'
import { createClient } from '@/lib/supabase/server'
import { LINK_CATEGORIAS, type LinkFormInput } from '@/types/central-servicos'

/**
 * POST /api/central-servicos/links — cria um link útil.
 * Guard: check_permission('central_servicos', 'create') (super_admin + diretor).
 * A RLS da tabela reforça a mesma checagem no banco.
 */
export async function POST(request: Request) {
  try {
    const guard = await requirePermissionApi('central_servicos', 'create')
    if (!guard.ok) return guard.response

    const body = (await request.json()) as LinkFormInput
    const nome = body.nome?.trim()
    const url = body.url?.trim()

    if (!nome) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 })
    if (!url) return NextResponse.json({ error: 'URL é obrigatória.' }, { status: 400 })
    if (!LINK_CATEGORIAS.includes(body.categoria)) {
      return NextResponse.json({ error: 'Categoria inválida.' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    const { data: userRes } = await supabase.auth.getUser()
    const created_by = userRes?.user?.id ?? null

    // Nova entrada vai ao final da sua categoria.
    const { data: maxRow } = await supabase
      .from('central_servicos_links')
      .select('ordem')
      .eq('categoria', body.categoria)
      .order('ordem', { ascending: false })
      .limit(1)
      .maybeSingle()

    const ordem = maxRow ? (maxRow.ordem as number) + 1 : 0

    const { data, error } = await supabase
      .from('central_servicos_links')
      .insert({
        nome,
        descricao: body.descricao?.trim() || null,
        categoria: body.categoria,
        url,
        icone_url: body.icone_url?.trim() || null,
        ativo: body.ativo ?? true,
        ordem,
        created_by,
      })
      .select('id')
      .single()

    if (error) throw error
    return NextResponse.json({ data: { id: data.id } })
  } catch (err) {
    console.error('[POST /api/central-servicos/links]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
