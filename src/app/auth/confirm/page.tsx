'use client'

import { useEffect, useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Página client-side que trata o fluxo implícito do GoTrue (invite / recovery).
// O GoTrue redireciona para esta página com os tokens no hash:
// /auth/confirm#access_token=...&refresh_token=...&type=invite
export default function AuthConfirmPage() {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const accessToken  = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const type         = params.get('type') // 'invite' | 'recovery' | 'signup'

    if (!accessToken || !refreshToken) {
      setError('Link inválido ou expirado.')
      return
    }

    const supabase = createClient()
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error: sessionError }) => {
        if (sessionError) {
          setError('Não foi possível confirmar o convite. O link pode ter expirado.')
          return
        }
        // Reload completo para o middleware detectar a sessão nos cookies
        // Convites: página de definir senha. Recovery/outros: dashboard.
        const next = type === 'invite' ? '/auth/setup-senha' : '/dashboard'
        window.location.href = next
      })
  }, [])

  if (error) {
    return (
      <div className="min-h-svh flex items-center justify-center bg-background p-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="text-lg font-semibold text-foreground">Link inválido</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <a href="/login" className="inline-block text-sm text-primary underline underline-offset-4">
            Ir para o login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-svh flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Confirmando convite…</p>
      </div>
    </div>
  )
}
