/**
 * Utilitários para tratar ChunkLoadError pós-deploy com elegância.
 *
 * ChunkLoadError acontece quando o usuário tem a aba aberta durante um deploy:
 * o browser tenta carregar um chunk JS com hash antigo que o servidor já não serve.
 * A solução correta é um hard reload (window.location.reload), não reset() do Next
 * (que tenta recarregar o código velho do cache e falha novamente).
 *
 * Convenções compartilhadas com ServiceWorkerUpdater:
 * - 'sw-reloading' (sessionStorage): sinaliza ao controllerchange que o reload
 *   foi iniciado por nós — evita que o SW dispare o toast de "nova versão" logo
 *   após o reload que já resolveu o problema.
 */

const CHUNK_RELOAD_KEY = 'cachola:chunk-reload-at'
const SW_RELOAD_KEY    = 'sw-reloading'
const ANTI_LOOP_MS     = 15_000   // 15 s de janela anti-loop

/** Padrões que identificam erros de chunk JS não encontrado pós-deploy. */
const CHUNK_ERROR_PATTERNS = [
  'loading chunk',
  'failed to fetch dynamically imported module',
  'importing a module script failed',
  'error loading dynamically imported module',
] as const

/**
 * Retorna true quando o erro é um ChunkLoadError ou equivalente de importação
 * dinâmica falha — indica que o bundle mudou no servidor (novo deploy).
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { name?: string; message?: string }

  if (e.name === 'ChunkLoadError') return true

  const msg = (e.message ?? '').toLowerCase()
  return CHUNK_ERROR_PATTERNS.some((pattern) => msg.includes(pattern))
}

/**
 * Dispara um hard reload para buscar o novo bundle, com guarda anti-loop.
 *
 * Guarda de tempo: se já houve um reload nos últimos 15 s, assume-se que o
 * reload não resolveu (ex.: erro persistente ou bug real) e retorna false,
 * deixando a tela de erro exibida em vez de entrar em loop infinito.
 *
 * @returns true se o reload foi disparado, false se a guarda bloqueou.
 */
export function reloadForNewVersion(): boolean {
  if (typeof window === 'undefined') return false

  const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? '0')
  if (Date.now() - lastReload < ANTI_LOOP_MS) return false

  // Registra o timestamp antes de recarregar para que a próxima instância
  // desta função (pós-reload) possa detectar o loop.
  sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()))

  // Sinaliza ao ServiceWorkerUpdater para ignorar o controllerchange
  // provocado por este reload (mesma convenção do doReload em service-worker-updater.tsx).
  sessionStorage.setItem(SW_RELOAD_KEY, '1')

  // Limpa caches do SW antigo (fire-and-forget — não bloqueia o reload).
  if ('caches' in window) {
    void caches.keys().then((names) => names.forEach((n) => void caches.delete(n)))
  }

  window.location.reload()
  return true
}
