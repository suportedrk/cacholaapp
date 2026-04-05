// ============================================================
// Ploomes CRM — HTTP Client
// ============================================================
// Singleton com autenticação via User-Key, retry automático
// (3x com backoff exponencial) para erros 429/5xx e timeout de 30s.
//
// A User-Key é lida preferencialmente da tabela `ploomes_config`
// no banco de dados (por unidade). O env var PLOOMES_USER_KEY
// serve apenas como fallback de compatibilidade.

import type { PloomesODataResponse } from './types'

const BASE_URL  = process.env.PLOOMES_API_URL ?? 'https://api2.ploomes.com/'
const TIMEOUT   = 30_000 // 30s
const MAX_RETRY = 3

/** Fallback: chave configurada via variável de ambiente (legado) */
const ENV_USER_KEY = process.env.PLOOMES_USER_KEY ?? ''

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function fetchWithTimeout(url: string, opts: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...opts, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function ploomesRequest<T>(
  path: string,
  options: RequestInit = {},
  userKey?: string,
): Promise<T> {
  const key = userKey || ENV_USER_KEY

  if (!key) {
    throw new Error('Chave de API do Ploomes não configurada. Acesse Configurações → Integrações → Ploomes → Mapeamento e informe a User-Key.')
  }

  const url = `${BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`

  const headers: HeadersInit = {
    'User-Key': key,
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
  }

  let lastError: Error = new Error('Falha desconhecida')

  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      if (process.env.NODE_ENV !== 'production') {
        console.debug(`[Ploomes] ${options.method ?? 'GET'} ${url} (tentativa ${attempt}/${MAX_RETRY})`)
      }

      const response = await fetchWithTimeout(url, { ...options, headers }, TIMEOUT)

      // Sucesso
      if (response.ok) {
        const text = await response.text()
        return text ? (JSON.parse(text) as T) : ({} as T)
      }

      // Rate limit → retry com backoff
      if (response.status === 429 && attempt < MAX_RETRY) {
        const retryAfter = parseInt(response.headers.get('Retry-After') ?? '2', 10)
        await sleep(retryAfter * 1000)
        continue
      }

      // Erros de servidor → retry com backoff exponencial
      if (response.status >= 500 && attempt < MAX_RETRY) {
        await sleep(2 ** attempt * 500)
        continue
      }

      // Erro sem retry
      const body = await response.text().catch(() => '')
      lastError = new Error(`Ploomes API ${response.status}: ${body}`)
      console.error(`[Ploomes] Erro ${response.status} em ${url}:`, body)
      throw lastError
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        lastError = new Error(`Ploomes API timeout após ${TIMEOUT / 1000}s: ${url}`)
      } else if (err instanceof Error) {
        lastError = err
      }

      if (attempt < MAX_RETRY) {
        await sleep(2 ** attempt * 500)
        continue
      }
      throw lastError
    }
  }

  throw lastError
}

// ── API pública ──────────────────────────────────────────────

/** GET que retorna uma lista OData `{ value: T[] }` */
export async function ploomesGet<T>(path: string, userKey?: string): Promise<PloomesODataResponse<T>> {
  return ploomesRequest<PloomesODataResponse<T>>(path, {}, userKey)
}

/** GET que retorna um único item */
export async function ploomesGetOne<T>(path: string, userKey?: string): Promise<T> {
  return ploomesRequest<T>(path, {}, userKey)
}

/** POST com JSON body */
export async function ploomesPost<T>(path: string, body: unknown, userKey?: string): Promise<T> {
  return ploomesRequest<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  }, userKey)
}

/** POST multipart/form-data (upload de arquivo) */
export async function ploomesUpload<T>(path: string, formData: FormData, userKey?: string): Promise<T> {
  const key = userKey || ENV_USER_KEY

  if (!key) {
    throw new Error('Chave de API do Ploomes não configurada.')
  }

  const url = `${BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`

  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'User-Key': key },
      body: formData,
    },
    TIMEOUT,
  )

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Ploomes upload ${response.status}: ${body}`)
  }

  const text = await response.text()
  return text ? (JSON.parse(text) as T) : ({} as T)
}
