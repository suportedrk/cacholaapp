'use client'

/**
 * ServiceWorkerUpdater
 *
 * Detecta novos deploys por dois caminhos complementares:
 *
 * 1. `controllerchange` — o SW novo ativa (skipWaiting) e assume controle.
 *    Um guard de sessionStorage previne loop infinito de reload.
 *
 * 2. Polling `/api/build-info` — verifica o BUILD_ID a cada 5 min e no
 *    focus da janela. Cobre casos onde controllerchange não é confiável
 *    (múltiplas abas, SW já instalado antes da sessão).
 *
 * Ao detectar nova versão, exibe toast Sonner com "Atualizar agora" e
 * auto-recarrega após 30 s, respeitando formulários com texto digitado.
 *
 * REGRAS ARQUITETURAIS:
 * - Deve ser montado DENTRO de <Providers> em (auth)/layout.tsx para que
 *   o <Toaster> do Sonner esteja disponível na árvore.
 * - Com skipWaiting: true, reg.waiting é sempre null — não usar postMessage.
 * - generateBuildId e env ficam em nextConfig, NUNCA dentro de withPWA({...}).
 */

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

const POLL_INTERVAL_MS  = 5 * 60 * 1000  // 5 minutos
const AUTO_RELOAD_MS    = 30 * 1000       // 30 segundos
const SW_RELOAD_KEY     = 'sw-reloading'  // sessionStorage flag anti-loop

/** Retorna true se o usuário está digitando em um campo não-vazio. */
function isUserActivelyInputting(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  if (
    tag === 'input' ||
    tag === 'textarea' ||
    (el as HTMLElement).isContentEditable
  ) {
    return ((el as HTMLInputElement).value ?? '').length > 0
  }
  return false
}

/**
 * Executa o reload com segurança:
 * - Seta flag de sessionStorage para o guard do controllerchange.
 * - Adia se o usuário estiver digitando (retry em 5 s).
 * - Deleta caches obsoletos em background antes de recarregar.
 */
function doReload() {
  if (isUserActivelyInputting()) {
    setTimeout(doReload, 5_000)
    return
  }

  // Flag que o próximo controllerchange é consequência deste reload — ignorar.
  sessionStorage.setItem(SW_RELOAD_KEY, '1')

  // Limpa caches do SW antigo (fire-and-forget — não bloqueia o reload).
  if ('caches' in window) {
    void caches.keys().then((names) => names.forEach((n) => caches.delete(n)))
  }

  window.location.reload()
}

/** Exibe o toast de atualização e agenda o auto-reload em 30 s. */
function showUpdateToast() {
  let autoReloadTimer: ReturnType<typeof setTimeout> | null = null

  const clearTimer = () => {
    if (autoReloadTimer) clearTimeout(autoReloadTimer)
  }

  toast('Nova versão disponível', {
    description: 'O app foi atualizado. Recarregue para usar a versão mais recente.',
    duration: Infinity,
    action: {
      label: 'Atualizar agora',
      onClick: () => {
        clearTimer()
        doReload()
      },
    },
    onDismiss: clearTimer,
  })

  autoReloadTimer = setTimeout(doReload, AUTO_RELOAD_MS)
}

export function ServiceWorkerUpdater() {
  const buildId       = process.env.NEXT_PUBLIC_BUILD_ID
  const toastShownRef = useRef(false)
  const lastBuildRef  = useRef<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    // ── 1. Guard: controllerchange com proteção anti-loop ─────────────────
    //
    // Com skipWaiting + clientsClaim, o novo SW assume controle de todas as
    // abas abertas imediatamente após ativar. Isso dispara controllerchange
    // em cada aba. Sem o guard, cada reload re-dispararia o evento.
    //
    // Também rastreamos se havia um controller anterior para não mostrar
    // o toast na primeira vez que o SW é instalado (fresh install).
    //
    let previousController: ServiceWorker | null = navigator.serviceWorker.controller

    const handleControllerChange = () => {
      const hadController = previousController !== null
      previousController  = navigator.serviceWorker.controller

      // Se este reload foi iniciado por nós mesmos — ignorar.
      if (sessionStorage.getItem(SW_RELOAD_KEY)) {
        sessionStorage.removeItem(SW_RELOAD_KEY)
        return
      }

      // Se era a primeira instalação do SW (sem controller anterior) — ignorar.
      if (!hadController) return

      if (!toastShownRef.current) {
        toastShownRef.current = true
        showUpdateToast()
      }
    }

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    // ── 2. Polling /api/build-info ─────────────────────────────────────────
    if (!buildId) {
      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
      }
    }

    lastBuildRef.current = buildId

    const checkForUpdate = async () => {
      try {
        const res = await fetch('/api/build-info', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as { buildId?: string }
        if (data.buildId && data.buildId !== lastBuildRef.current) {
          if (!toastShownRef.current) {
            toastShownRef.current = true
            showUpdateToast()
          }
        }
      } catch {
        // Falha de rede — ignorar silenciosamente.
      }
    }

    const intervalId = setInterval(() => void checkForUpdate(), POLL_INTERVAL_MS)
    const handleFocus = () => void checkForUpdate()
    window.addEventListener('focus', handleFocus)

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
      clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
    }
  }, [buildId])

  return null
}
