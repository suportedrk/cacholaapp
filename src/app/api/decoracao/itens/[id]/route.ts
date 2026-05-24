import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import { DECORACAO_MANAGE_ROLES, DECORACAO_DELETE_ROLES } from '@/config/roles'
import type { ItemFormInput } from '@/types/decoracao'

function mapPgError(code?: string, msg?: string): { status: number; error: string } | null {
  if (code === '42501') return { status: 403, error: 'Item não encontrado ou sem permissão.' }
  if (msg === 'item_nao_encontrado_ou_sem_permissao') return { status: 404, error: 'Item não encontrado.' }
  if (msg === 'nome_obrigatorio') return { status: 400, error: 'Nome é obrigatório.' }
  if (msg === 'tipo_invalido') return { status: 400, error: 'Tipo deve ser próprio ou alugado.' }
  if (msg === 'pelo_menos_uma_variacao') return { status: 400, error: 'Cadastre pelo menos uma variação.' }
  if (code === '23514') return { status: 400, error: 'Dados inválidos: verifique os campos da variação.' }
  return null
}

/** Atualiza item + reconcilia variações (upsert + delete) em transação atômica. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireRoleApi(DECORACAO_MANAGE_ROLES)
    if (!guard.ok) return guard.response

    const { id } = await params
    const body = (await request.json()) as ItemFormInput
    const nome = body.nome?.trim()
    if (!nome) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 })
    if (body.tipo !== 'proprio' && body.tipo !== 'alugado') {
      return NextResponse.json({ error: 'Tipo deve ser próprio ou alugado.' }, { status: 400 })
    }
    if (!Array.isArray(body.variacoes) || body.variacoes.length === 0) {
      return NextResponse.json({ error: 'Cadastre pelo menos uma variação.' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    const { error } = await supabase.rpc('update_decoracao_item_with_variacoes', {
      p_id: id,
      p_nome: nome,
      p_tipo: body.tipo,
      p_fornecedor_id: body.tipo === 'alugado' ? body.fornecedor_id ?? null : null,
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
    const guard = await requireRoleApi(DECORACAO_DELETE_ROLES)
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
