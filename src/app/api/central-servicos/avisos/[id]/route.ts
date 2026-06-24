import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth/require-permission'
import { createClient } from '@/lib/supabase/server'
import {
  AVISO_CATEGORIAS,
  AVISO_PRIORIDADES,
  CONTATO_UNIDADES,
  AVISOS_ANEXOS_BUCKET,
  type AvisoFormInput,
} from '@/types/central-servicos'

/**
 * PATCH /api/central-servicos/avisos/[id] — edita um aviso.
 * Guard: check_permission('central_servicos', 'edit').
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requirePermissionApi('central_servicos', 'edit')
    if (!guard.ok) return guard.response

    const { id } = await params
    const body = (await request.json()) as AvisoFormInput
    const titulo = body.titulo?.trim()
    const conteudo = body.conteudo?.trim()

    if (!titulo) return NextResponse.json({ error: 'Título é obrigatório.' }, { status: 400 })
    if (!conteudo) return NextResponse.json({ error: 'Conteúdo é obrigatório.' }, { status: 400 })
    if (!AVISO_CATEGORIAS.includes(body.categoria)) {
      return NextResponse.json({ error: 'Categoria inválida.' }, { status: 400 })
    }
    if (!AVISO_PRIORIDADES.includes(body.prioridade)) {
      return NextResponse.json({ error: 'Prioridade inválida.' }, { status: 400 })
    }
    if (!CONTATO_UNIDADES.includes(body.unidade)) {
      return NextResponse.json({ error: 'Unidade inválida.' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    const { error } = await supabase
      .from('central_servicos_avisos')
      .update({
        titulo,
        conteudo,
        categoria: body.categoria,
        prioridade: body.prioridade,
        unidade: body.unidade,
        publicado_em: body.publicado_em || new Date().toISOString(),
        expira_em: body.expira_em || null,
        exige_confirmacao: body.exige_confirmacao === true,
      })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ data: { id } })
  } catch (err) {
    console.error('[PATCH /api/central-servicos/avisos/[id]]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

/**
 * DELETE /api/central-servicos/avisos/[id] — exclui um aviso.
 * Guard: check_permission('central_servicos', 'delete').
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

    // Remove os objetos de Storage dos anexos antes de apagar o aviso — a FK
    // ON DELETE CASCADE limpa só as linhas de metadata, não o binário no bucket.
    const { data: anexos } = await supabase
      .from('central_servicos_aviso_anexos')
      .select('storage_path')
      .eq('aviso_id', id)
    const paths = (anexos ?? []).map((a: { storage_path: string }) => a.storage_path)
    if (paths.length > 0) {
      const { error: storageErr } = await supabase.storage.from(AVISOS_ANEXOS_BUCKET).remove(paths)
      if (storageErr) console.error('[DELETE aviso] anexos de storage não removidos:', storageErr)
    }

    const { error } = await supabase.from('central_servicos_avisos').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/central-servicos/avisos/[id]]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
