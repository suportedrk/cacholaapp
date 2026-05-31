import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePermissionApi } from '@/lib/auth/require-permission'
import type { ItemFormInput } from '@/types/decoracao'

function mapPgError(code?: string, msg?: string): { status: number; error: string } | null {
  if (code === '42501') return { status: 403, error: 'Item não encontrado ou sem permissão.' }
  if (msg === 'item_nao_encontrado_ou_sem_permissao') return { status: 404, error: 'Item não encontrado.' }
  if (msg === 'nome_obrigatorio') return { status: 400, error: 'Nome é obrigatório.' }
  if (msg === 'origem_invalida') return { status: 400, error: 'Origem deve ser acervo ou fornecedor.' }
  if (msg === 'pelo_menos_uma_variacao') return { status: 400, error: 'Cadastre pelo menos uma variação.' }
  if (code === '23514') return { status: 400, error: 'Dados inválidos: verifique origem, fornecedor e variações.' }
  if (code === '23503') return { status: 400, error: 'Categoria inválida ou inexistente.' }
  return null
}

/** Atualiza item + reconcilia variações (upsert + delete) em transação atômica. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requirePermissionApi('decoracao', 'edit')
    if (!guard.ok) return guard.response

    const { id } = await params
    const body = (await request.json()) as ItemFormInput
    const nome = body.nome?.trim()
    if (!nome) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 })
    if (body.origem !== 'acervo' && body.origem !== 'fornecedor') {
      return NextResponse.json({ error: 'Origem deve ser acervo ou fornecedor.' }, { status: 400 })
    }
    if (body.origem === 'fornecedor' && !body.fornecedor_id) {
      return NextResponse.json({ error: 'Selecione um fornecedor.' }, { status: 400 })
    }
    if (!body.categoria_id) {
      return NextResponse.json({ error: 'Selecione uma categoria.' }, { status: 400 })
    }
    if (!Array.isArray(body.variacoes) || body.variacoes.length === 0) {
      return NextResponse.json({ error: 'Cadastre pelo menos uma variação.' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    const { error } = await supabase.rpc('update_decoracao_item_with_variacoes', {
      p_id: id,
      p_nome: nome,
      p_origem: body.origem,
      p_fornecedor_id: body.origem === 'fornecedor' ? body.fornecedor_id ?? null : null,
      p_categoria_id: body.categoria_id,
      p_preco_custo: body.preco_custo ?? 0,
      p_preco_venda: body.preco_venda ?? 0,
      p_foto_path: body.foto_path ?? null,
      p_observacoes: body.observacoes?.trim() || null,
      p_ativo: body.ativo ?? true,
      p_variacoes: body.variacoes,
    })

    if (error) {
      const mapped = mapPgError(error.code, error.message)
      if (mapped) return NextResponse.json({ error: mapped.error }, { status: mapped.status })
      throw error
    }

    return NextResponse.json({ data: { id } })
  } catch (err) {
    console.error('[PATCH /api/decoracao/itens/[id]]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

/** Exclui o item — cascade apaga variações. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requirePermissionApi('decoracao', 'delete')
    if (!guard.ok) return guard.response

    const { id } = await params

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    const { error } = await supabase.from('decoracao_itens').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/decoracao/itens/[id]]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
