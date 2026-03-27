'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signIn, loading, isAuthenticated } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const redirectTo = searchParams.get('redirectTo') ?? '/dashboard'
  const callbackError = searchParams.get('error')

  // Usuário já autenticado → redirecionar
  useEffect(() => {
    if (isAuthenticated) {
      router.replace(redirectTo)
    }
  }, [isAuthenticated, router, redirectTo])

  // Erro de callback (ex: link expirado)
  useEffect(() => {
    if (callbackError) {
      setServerError('O link expirou ou é inválido. Solicite um novo.')
    }
  }, [callbackError])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldError(null)
    setServerError(null)

    if (!email.trim()) {
      setFieldError('Informe seu e-mail.')
      return
    }
    if (!password) {
      setFieldError('Informe sua senha.')
      return
    }

    const result = await signIn(email.trim().toLowerCase(), password)

    if (!result.success && result.error) {
      setServerError(result.error)
    } else if (result.success) {
      router.replace(redirectTo)
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">

        {/* Logo e título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4 shadow-md">
            <span className="text-2xl font-bold text-primary-foreground">C</span>
          </div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            Cachola OS
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Faça login para continuar
          </p>
        </div>

        {/* Card do formulário */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-6">

          {/* Erro de servidor */}
          {serverError && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">

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
                  setFieldError(null)
                }}
                placeholder="seu@email.com"
                className={cn(
                  'w-full h-11 px-3 rounded-lg border bg-background text-foreground placeholder:text-muted-foreground',
                  'text-base transition-colors outline-none',
                  'focus:ring-2 focus:ring-ring focus:border-ring',
                  fieldError && !email ? 'border-destructive ring-1 ring-destructive' : 'border-input'
                )}
              />
            </div>

            {/* Campo Senha */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-foreground">
                  Senha
                </label>
                <Link
                  href="/recuperar-senha"
                  className="text-xs text-primary hover:text-brand-primary-dark transition-colors"
                >
                  Esqueci minha senha
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setFieldError(null)
                  }}
                  placeholder="••••••••"
                  className={cn(
                    'w-full h-11 px-3 pr-11 rounded-lg border bg-background text-foreground placeholder:text-muted-foreground',
                    'text-base transition-colors outline-none',
                    'focus:ring-2 focus:ring-ring focus:border-ring',
                    fieldError && !password ? 'border-destructive ring-1 ring-destructive' : 'border-input'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Erro de campo */}
            {fieldError && (
              <p className="text-sm text-destructive">{fieldError}</p>
            )}

            {/* Botão de submit */}
            <Button
              type="submit"
              className="w-full h-11 text-base font-medium"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>
        </div>

        {/* Rodapé */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Cachola OS v{process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0'}
        </p>
      </div>
    </main>
  )
}

// useSearchParams() requer Suspense boundary no Next.js 15+
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
