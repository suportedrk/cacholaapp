import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth/require-permission'
import { createClient } from '@/lib/supabase/server'
import { LINK_CATEGORIAS, type LinkFormInput } from '@/types/central-servicos'

/**
 * PATCH /api/central-servicos/links/[id] — edita um link útil.
 * Guard: check_permission('central_servicos', 'edit') (super_admin + diretor).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requirePermissionApi('central_servicos', 'edit')
    if (!guard.ok) return guard.response

    const { id } = await params
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

    const { error } = await supabase
      .from('central_servicos_links')
      .update({
        nome,
        descricao: body.descricao?.trim() || null,
        categoria: body.categoria,
        url,
        icone_url: body.icone_url?.trim() || null,
        ativo: body.ativo ?? true,
      })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ data: { id } })
  } catch (err) {
    console.error('[PATCH /api/central-servicos/links/[id]]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

/**
 * DELETE /api/central-servicos/links/[id] — exclui um link útil.
 * Guard: check_permission('central_servicos', 'delete') (super_admin + diretor).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requirePermissionApi('central_servicos', 'delete')
    if (!guard.ok) return guard.response

    const { id } = await params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    const { error } = await supabase
      .from('central_servicos_links')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/central-servicos/links/[id]]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
