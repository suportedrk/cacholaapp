/**
 * Helpers para montar filtros do PostgREST com input do usuário de forma segura.
 */

/**
 * Monta um filtro PostgREST `.or()` de `ilike` em múltiplas colunas,
 * neutralizando os metacaracteres do parser de filtro do PostgREST
 * (vírgula separa termos, parênteses agrupam, barra invertida escapa).
 *
 * Sem isso, um termo de busca contendo `,` `(` `)` quebra a sintaxe do filtro
 * (erro 400) ou altera a lógica do `.or()`. NÃO é bypass de tenant — todas as
 * queries que usam isto rodam sob a sessão do usuário (RLS) com `.eq('unit_id')`
 * aplicado em AND independente; é robustez/higiene de input. (A03:2025)
 *
 * @example
 *   q.or(orIlike(['title', 'description'], search))
 */
export function orIlike(columns: string[], term: string): string {
  const safe = term.replace(/[,()\\]/g, ' ').trim()
  return columns.map((c) => `${c}.ilike.%${safe}%`).join(',')
}
