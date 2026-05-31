import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePermissionApi } from '@/lib/auth/require-permission'
import type { ItemFormInput } from '@/types/decoracao'

function mapPgError(code?: string, msg?: string): { status: number; error: string } | null {
  if (code === '42501') return { status: 403, error: 'Sem permissão para esta operação.' }
  if (msg === 'nome_obrigatorio') return { status: 400, error: 'Nome é obrigatório.' }
  if (msg === 'origem_invalida') return { status: 400, error: 'Origem deve ser acervo ou fornecedor.' }
  if (msg === 'pelo_menos_uma_variacao') return { status: 400, error: 'Cadastre pelo menos uma variação.' }
  if (code === '23514') return { status: 400, error: 'Dados inválidos: verifique origem, fornecedor e variações.' }
  if (code === '23503') return { status: 400, error: 'Categoria inválida ou inexistente.' }
  return null
}

/** Cria item + variações em uma transação atômica via RPC. */
export async function POST(request: Request) {
  try {
    const guard = await requirePermissionApi('decoracao', 'create')
    if (!guard.ok) return guard.response

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

    const { data, error } = await supabase.rpc('create_decoracao_item_with_variacoes', {
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

    return NextResponse.json({ data: { id: data } })
  } catch (err) {
    console.error('[POST /api/decoracao/itens]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
