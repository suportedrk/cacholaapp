import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth/require-permission'
import { createClient } from '@/lib/supabase/server'
import { CONTATO_UNIDADES, CONTATOS_BUCKET, type ContatoFormInput } from '@/types/central-servicos'

/**
 * PATCH /api/central-servicos/contatos/[id] — edita um contato.
 * Guard: check_permission('central_servicos', 'edit'). Inativar = setar ativo=false.
 * Se a foto for trocada/removida, o arquivo antigo é apagado do storage.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requirePermissionApi('central_servicos', 'edit')
    if (!guard.ok) return guard.response

    const { id } = await params
    const body = (await request.json()) as ContatoFormInput
    const nome = body.nome?.trim()

    if (!nome) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 })
    if (!CONTATO_UNIDADES.includes(body.unidade)) {
      return NextResponse.json({ error: 'Unidade inválida.' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    // Foto antiga, para limpar do storage se foi trocada/removida.
    const { data: prev } = await supabase
      .from('central_servicos_contatos')
      .select('foto_path')
      .eq('id', id)
      .maybeSingle()

    const newFoto = body.foto_path?.trim() || null

    const { error } = await supabase
      .from('central_servicos_contatos')
      .update({
        nome,
        setor: body.setor?.trim() || null,
        cargo: body.cargo?.trim() || null,
        unidade: body.unidade,
        email: body.email?.trim() || null,
        telefone: body.telefone?.trim() || null,
        foto_path: newFoto,
        ativo: body.ativo ?? true,
      })
      .eq('id', id)

    if (error) throw error

    const oldFoto = prev?.foto_path as string | null | undefined
    if (oldFoto && oldFoto !== newFoto) {
      supabase.storage
        .from(CONTATOS_BUCKET)
        .remove([oldFoto])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .catch((e: any) => console.warn('[PATCH contato — limpar foto antiga]', oldFoto, e))
    }

    return NextResponse.json({ data: { id } })
  } catch (err) {
    console.error('[PATCH /api/central-servicos/contatos/[id]]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

/**
 * DELETE /api/central-servicos/contatos/[id] — exclui um contato em definitivo.
 * Guard: check_permission('central_servicos', 'delete') (só Diretoria/super_admin).
 * Inativar é o caminho normal de saída; exclusão é permanente.
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

    const { data: prev } = await supabase
      .from('central_servicos_contatos')
      .select('foto_path')
      .eq('id', id)
      .maybeSingle()

    const { error } = await supabase
      .from('central_servicos_contatos')
      .delete()
      .eq('id', id)

    if (error) throw error

    const foto = prev?.foto_path as string | null | undefined
    if (foto) {
      supabase.storage
        .from(CONTATOS_BUCKET)
        .remove([foto])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .catch((e: any) => console.warn('[DELETE contato — limpar foto]', foto, e))
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/central-servicos/contatos/[id]]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
