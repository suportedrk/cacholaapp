import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth/require-permission'
import { createClient } from '@/lib/supabase/server'
import { AVISO_ANEXO_MIME_TYPES } from '@/types/central-servicos'

/**
 * POST /api/central-servicos/avisos/[id]/anexos — registra a metadata de um anexo
 * já enviado ao Storage (o binário sobe direto do client para o bucket privado).
 * Guard: check_permission('central_servicos', 'create') OU 'edit' — a RLS reforça.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // create (ao publicar) OU edit (ao editar) podem anexar.
    let guard = await requirePermissionApi('central_servicos', 'create')
    if (!guard.ok) guard = await requirePermissionApi('central_servicos', 'edit')
    if (!guard.ok) return guard.response

    const { id } = await params
    const body = (await request.json()) as {
      storage_path?: string
      file_name?: string
      mime_type?: string | null
      size_bytes?: number | null
    }

    const storage_path = body.storage_path?.trim()
    const file_name = body.file_name?.trim()

    if (!storage_path) return NextResponse.json({ error: 'storage_path é obrigatório.' }, { status: 400 })
    if (!file_name) return NextResponse.json({ error: 'file_name é obrigatório.' }, { status: 400 })
    // Trava o formato do path (pasta "avisos/" + chars seguros) — bloqueia path traversal
    // e impede apontar a metadata para um objeto fora do padrão do uploader.
    if (!/^avisos\/[A-Za-z0-9._-]+$/.test(storage_path)) {
      return NextResponse.json({ error: 'storage_path inválido.' }, { status: 400 })
    }
    if (body.mime_type && !AVISO_ANEXO_MIME_TYPES.includes(body.mime_type as typeof AVISO_ANEXO_MIME_TYPES[number])) {
      return NextResponse.json({ error: 'Tipo de arquivo não permitido.' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any
    const { data: userRes } = await supabase.auth.getUser()
    const created_by = userRes?.user?.id ?? null

    const { data, error } = await supabase
      .from('central_servicos_aviso_anexos')
      .insert({
        aviso_id: id,
        storage_path,
        file_name,
        mime_type: body.mime_type ?? null,
        size_bytes: typeof body.size_bytes === 'number' ? body.size_bytes : null,
        created_by,
      })
      .select('id')
      .single()

    if (error) throw error
    return NextResponse.json({ data: { id: data.id } })
  } catch (err) {
    console.error('[POST /api/central-servicos/avisos/[id]/anexos]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
