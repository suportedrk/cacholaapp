import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePermissionApi } from '@/lib/auth/require-permission'
import { sanitizeReceita } from '../receita-utils'

interface TemaReceitaBodyItem {
  variacao_id?: string
  quantidade?: number
  ordem?: number
}

interface TemaBody {
  nome?: string
  categoria?: string | null
  ativo?: boolean
  observacoes?: string | null
  personalizado?: boolean
  decoradora_externa?: boolean
  forminha_cor_ids?: string[]
  foto_url?: string | null
  receita?: TemaReceitaBodyItem[]
}

/** Edita um tema — aceita patch parcial. Quando forminha_cor_ids ou receita estão presentes, substituem o conjunto correspondente. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Convert-as-we-touch (Bloco B): guard por permissão configurável, não cargo.
    const guard = await requirePermissionApi('decoracao', 'edit')
    if (!guard.ok) return guard.response

    const { id } = await params
    const body = (await request.json()) as TemaBody

    const patch: Record<string, unknown> = {}

    if ('nome' in body) {
      const nome = body.nome?.trim()
      if (!nome) return NextResponse.json({ error: 'Nome do tema é obrigatório.' }, { status: 400 })
      patch.nome = nome
    }
    if ('categoria' in body) patch.categoria = body.categoria?.trim() || null
    if ('ativo' in body) patch.ativo = body.ativo
    if ('observacoes' in body) patch.observacoes = body.observacoes?.trim() || null
    if ('personalizado' in body) patch.personalizado = body.personalizado
    if ('decoradora_externa' in body) patch.decoradora_externa = body.decoradora_externa
    if ('foto_url' in body) patch.foto_url = body.foto_url ?? null

    const updateForminhas = 'forminha_cor_ids' in body
    const updateReceita = 'receita' in body

    if (Object.keys(patch).length === 0 && !updateForminhas && !updateReceita) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar.' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    if (Object.keys(patch).length > 0) {
      const { data: tema, error } = await supabase
        .from('decoracao_temas')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      if (!tema) return NextResponse.json({ error: 'Tema não encontrado.' }, { status: 404 })
    }

    if (updateForminhas) {
      const forminhaIds = Array.isArray(body.forminha_cor_ids)
        ? body.forminha_cor_ids.filter((v) => typeof v === 'string')
        : []

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
    }

    // Receita por último — gravação atômica via RPC (reconcilia numa transação).
    if (updateReceita) {
      const receita = sanitizeReceita(body.receita)
      const { error: receitaErr } = await supabase.rpc('update_tema_receita', {
        p_tema_id: id,
        p_itens: receita,
      })
      if (receitaErr) throw receitaErr
    }

    return NextResponse.json({ ok: true })
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
    const guard = await requirePermissionApi('decoracao', 'delete')
    if (!guard.ok) return guard.response

    const { id } = await params

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    const { error } = await supabase.from('decoracao_temas').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/decoracao/temas/[id]]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
