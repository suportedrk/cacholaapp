// ============================================================
// Ploomes CRM — HTTP Client
// ============================================================
// Singleton com autenticação via User-Key, retry automático
// (3x com backoff exponencial) para erros 429/5xx e timeout de 30s.

import type { PloomesODataResponse } from './types'

const BASE_URL  = process.env.PLOOMES_API_URL  ?? 'https://api2.ploomes.com/'
const USER_KEY  = process.env.PLOOMES_USER_KEY ?? ''
const TIMEOUT   = 30_000 // 30s
const MAX_RETRY = 3

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
): Promise<T> {
  if (!USER_KEY) {
    throw new Error('PLOOMES_USER_KEY não configurada. Adicione ao .env.')
  }

  const url = `${BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`

  const headers: HeadersInit = {
    'User-Key': USER_KEY,
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
export async function ploomesGet<T>(path: string): Promise<PloomesODataResponse<T>> {
  return ploomesRequest<PloomesODataResponse<T>>(path)
}

/** GET que retorna um único item */
export async function ploomesGetOne<T>(path: string): Promise<T> {
  return ploomesRequest<T>(path)
}

/** POST com JSON body */
export async function ploomesPost<T>(path: string, body: unknown): Promise<T> {
  return ploomesRequest<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** POST multipart/form-data (upload de arquivo) */
export async function ploomesUpload<T>(path: string, formData: FormData): Promise<T> {
  if (!USER_KEY) {
    throw new Error('PLOOMES_USER_KEY não configurada.')
  }

  const url = `${BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`

  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'User-Key': USER_KEY },
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
