'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'

export default function RecuperarSenhaPage() {
  const { resetPassword } = useAuth()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError('Informe seu e-mail.')
      return
    }

    setLoading(true)
    const result = await resetPassword(email.trim().toLowerCase())
    setLoading(false)

    if (result.success) {
      setSent(true)
    } else {
      setError(result.error ?? 'Erro ao enviar e-mail. Tente novamente.')
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">

        {/* Voltar */}
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para o login
        </Link>

        {/* Título */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-foreground">Recuperar senha</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Informe seu e-mail para receber o link de redefinição.
          </p>
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-6">

          {/* Estado: e-mail enviado */}
          {sent ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-12 h-12 text-[var(--status-success)] mx-auto mb-3" />
              <p className="font-medium text-foreground">E-mail enviado!</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Verifique sua caixa de entrada e siga as instruções.
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Não recebeu?{' '}
                <button
                  onClick={() => setSent(false)}
                  className="text-primary hover:underline"
                >
                  Tentar novamente
                </button>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">

              {/* Erro */}
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* Campo E-mail */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-medium text-foreground">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setError(null)
                  }}
                  placeholder="seu@email.com"
                  className={cn(
                    'w-full h-11 px-3 rounded-lg border bg-background text-foreground placeholder:text-muted-foreground',
                    'text-base transition-colors outline-none',
                    'focus:ring-2 focus:ring-ring focus:border-ring',
                    error ? 'border-destructive ring-1 ring-destructive' : 'border-input'
                  )}
                />
              </div>

              <Button type="submit" className="w-full h-11 text-base font-medium" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar link de recuperação'
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
