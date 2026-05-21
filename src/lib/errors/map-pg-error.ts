type PgErrorContext = {
  activeUnitId?: string | null
}

type PostgrestLike = {
  code: string
  message?: string
  details?: string | null
  hint?: string | null
}

function isPostgrestError(err: unknown): err is PostgrestLike {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as Record<string, unknown>).code === 'string'
  )
}

/**
 * Converte erros brutos do PostgREST/Supabase em mensagens amigáveis em PT-BR.
 * Sempre loga o erro cru no console antes de retornar.
 */
export function mapPgError(
  err: unknown,
  context: PgErrorContext = {},
  label = 'PG_ERROR',
): string {
  console.error(`[${label}]`, err)

  if (!isPostgrestError(err)) {
    return 'Não foi possível concluir a ação. Tente novamente.'
  }

  const { code } = err
  const { activeUnitId } = context

  if (code === '42501') {
    if (activeUnitId === null || activeUnitId === undefined) {
      return 'Selecione uma unidade antes de realizar esta ação.'
    }
    return 'Você não tem permissão para realizar esta ação nesta unidade.'
  }

  if (code === '23502') {
    return 'Campo obrigatório faltando. Contate o suporte.'
  }

  if (code === '23505') {
    return 'Já existe um registro com esses dados.'
  }

  return 'Não foi possível concluir a ação. Tente novamente.'
}
