'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Eye, EyeOff, Loader2, Mail, Lock,
  CheckCircle2, AlertCircle, WifiOff, Clock, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

// ─────────────────────────────────────────────────────────────
// ERROR CLASSIFICATION
// ─────────────────────────────────────────────────────────────

type ErrorType = 'credentials' | 'blocked' | 'rate_limit' | 'server' | 'unconfirmed'

interface LoginError {
  type: ErrorType
  message: string
}

function classifyError(error: string): LoginError {
  const lower = error.toLowerCase()
  if (
    lower.includes('invalid login') || lower.includes('invalid credentials') ||
    lower.includes('wrong password') || lower.includes('user not found') ||
    lower.includes('email not confirmed') === false && lower.includes('invalid')
  ) {
    return { type: 'credentials', message: 'E-mail ou senha incorretos. Verifique e tente novamente.' }
  }
  if (lower.includes('email not confirmed') || lower.includes('not confirmed')) {
    return { type: 'unconfirmed', message: 'E-mail não confirmado. Verifique sua caixa de entrada.' }
  }
  if (lower.includes('blocked') || lower.includes('banned') || lower.includes('disabled') || lower.includes('deactivated')) {
    return { type: 'blocked', message: 'Conta bloqueada ou desativada. Contate o administrador.' }
  }
  if (lower.includes('too many') || lower.includes('rate limit') || lower.includes('over_request_rate_limit')) {
    return { type: 'rate_limit', message: 'Muitas tentativas. Aguarde alguns instantes e tente novamente.' }
  }
  return { type: 'server', message: 'Serviço indisponível. Verifique sua conexão e tente novamente.' }
}

// ─────────────────────────────────────────────────────────────
// ERROR ALERT
// ─────────────────────────────────────────────────────────────

const ERROR_ICONS: Record<ErrorType, React.ElementType> = {
  credentials: AlertCircle,
  blocked:     AlertCircle,
  rate_limit:  Clock,
  server:      WifiOff,
  unconfirmed: AlertCircle,
}

function ErrorAlert({ error, onRetry }: { error: LoginError; onRetry?: () => void }) {
  const Icon = ERROR_ICONS[error.type]
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/[0.07] px-3.5 py-3"
    >
      <Icon className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-destructive leading-snug">{error.message}</p>
        {error.type === 'server' && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1 text-xs text-destructive/80 hover:text-destructive underline underline-offset-2 transition-colors"
          >
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// LEFT PANEL — branding (desktop only)
// ─────────────────────────────────────────────────────────────

const FEATURES = [
  'Eventos e escalas de equipe',
  'Checklists operacionais',
  'Ordens de manutenção',
]

function BrandingPanel() {
  return (
    <div className={cn(
      'hidden lg:flex flex-col items-center justify-center relative overflow-hidden select-none',
      /* Light: verde sálvia → bege quente */
      'bg-gradient-to-br from-brand-500 to-beige-500',
      /* Dark: verde escuro → verde médio */
      'dark:from-brand-900 dark:to-brand-700',
    )}>
      {/* Subtle dots pattern */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.55) 1.5px, transparent 1.5px)',
          backgroundSize: '28px 28px',
        }}
      />
      {/* Decorative blobs */}
      <div aria-hidden className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/[0.06]" />
      <div aria-hidden className="absolute -bottom-16 -right-16 w-56 h-56 rounded-full bg-black/[0.06] dark:bg-white/[0.04]" />
      <div aria-hidden className="absolute top-2/3 left-8 w-20 h-20 rounded-full bg-white/[0.08]" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-10 py-16">

        {/* Logo mark */}
        <div
          className="w-20 h-20 rounded-3xl bg-white/20 dark:bg-white/10 backdrop-blur-sm flex items-center justify-center mb-6 shadow-xl ring-1 ring-white/30 animate-fade-up"
          style={{ animationDelay: '0ms' }}
        >
          <span className="text-4xl font-bold text-white">C</span>
        </div>

        {/* Title + tagline */}
        <h1
          className="text-4xl font-bold text-white tracking-tight mb-2 animate-fade-up"
          style={{ animationDelay: '60ms' }}
        >
          Cachola OS
        </h1>
        <p
          className="text-lg text-white/75 leading-relaxed mb-10 animate-fade-up"
          style={{ animationDelay: '120ms' }}
        >
          Gestão inteligente de<br />buffets infantis
        </p>

        {/* Feature pills */}
        <div className="flex flex-col gap-2.5 w-full max-w-[240px]">
          {FEATURES.map((feat, i) => (
            <div
              key={feat}
              className="flex items-center gap-2.5 bg-white/[0.12] dark:bg-white/[0.08] backdrop-blur-sm rounded-xl px-4 py-2.5 animate-fade-up"
              style={{ animationDelay: `${200 + i * 60}ms` }}
            >
              <Check className="w-4 h-4 text-white/90 shrink-0" />
              <span className="text-sm text-white/85 text-left">{feat}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// LOGIN FORM
// ─────────────────────────────────────────────────────────────

type SubmitState = 'idle' | 'loading' | 'success'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signIn, isAuthenticated } = useAuth()

  const [email, setEmail]                 = useState('')
  const [password, setPassword]           = useState('')
  const [showPassword, setShowPassword]   = useState(false)
  const [rememberMe, setRememberMe]       = useState(false)
  const [fieldErrors, setFieldErrors]     = useState<{ email?: string; password?: string }>({})
  const [loginError, setLoginError]       = useState<LoginError | null>(null)
  const [submitState, setSubmitState]     = useState<SubmitState>('idle')

  const formCardRef = useRef<HTMLDivElement>(null)

  const redirectTo    = searchParams.get('redirectTo') ?? '/dashboard'
  const callbackError = searchParams.get('error')

  // Already authenticated → redirect
  useEffect(() => {
    if (isAuthenticated) router.replace(redirectTo)
  }, [isAuthenticated, router, redirectTo])

  // Callback error (e.g. expired link)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (callbackError) {
      setLoginError({ type: 'server', message: 'O link expirou ou é inválido. Solicite um novo.' })
    }
  }, [callbackError])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Shake the form card — restarts even if already shaking
  function triggerShake() {
    const el = formCardRef.current
    if (!el) return
    el.classList.remove('animate-login-shake')
    void el.offsetHeight // force reflow to restart animation
    el.classList.add('animate-login-shake')
    setTimeout(() => el.classList.remove('animate-login-shake'), 600)
  }

  function validate(): boolean {
    const errors: { email?: string; password?: string } = {}
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!email.trim()) {
      errors.email = 'Informe seu e-mail.'
    } else if (!emailRe.test(email.trim())) {
      errors.email = 'E-mail inválido.'
    }
    if (!password) {
      errors.password = 'Informe sua senha.'
    }

    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      triggerShake()
      return false
    }
    return true
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoginError(null)
    if (!validate()) return

    setSubmitState('loading')
    const result = await signIn(email.trim().toLowerCase(), password)

    if (!result.success && result.error) {
      setLoginError(classifyError(result.error))
      setSubmitState('idle')
      triggerShake()
    } else if (result.success) {
      setSubmitState('success')
      setTimeout(() => router.replace(redirectTo), 700)
    }
  }

  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleGoogleLogin() {
    setGoogleLoading(true)
    setLoginError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
        },
      })
      if (error) {
        setLoginError(classifyError(error.message))
        setGoogleLoading(false)
      }
      // On success, browser redirects to Google — no need to reset state
    } catch {
      setLoginError({ type: 'server', message: 'Erro ao iniciar login com Google. Tente novamente.' })
      setGoogleLoading(false)
    }
  }

  // Não usar `loading` de useAuth — o Supabase client auto-detecta #access_token=
  // na URL e seta loading=true por um instante, causando spinner sem o usuário submeter.
  // O redirectTo já é tratado pelo useEffect acima quando isAuthenticated=true.
  const isLoading = submitState === 'loading'
  const isSuccess = submitState === 'success'

  return (
    <div
      className="flex min-h-svh lg:min-h-0 flex-col items-center justify-center px-6 py-12 bg-background dark:bg-card pb-safe"
    >
      <div className="w-full max-w-sm">

        {/* Logo — mobile only */}
        <div
          className="lg:hidden text-center mb-8 animate-fade-up"
          style={{ animationDelay: '0ms' }}
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-3 shadow-md ring-1 ring-primary/20">
            <span className="text-2xl font-bold text-primary-foreground">C</span>
          </div>
        </div>

        {/* Heading */}
        <div
          className="mb-8 animate-fade-up"
          style={{ animationDelay: '60ms' }}
        >
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">
            Bem-vindo ao Cachola OS
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Entre com suas credenciais para continuar
          </p>
        </div>

        {/* Form card */}
        <div
          ref={formCardRef}
          className="bg-card border border-border rounded-2xl shadow-sm p-6 space-y-5 animate-fade-up"
          style={{ animationDelay: '100ms' }}
        >
          {/* Error alert */}
          {loginError && (
            <ErrorAlert
              error={loginError}
              onRetry={() => setLoginError(null)}
            />
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">

            {/* Email field */}
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="block text-sm font-medium text-foreground">
                E-mail
              </label>
              <div className="relative">
                <Mail className={cn(
                  'absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none transition-colors',
                  fieldErrors.email ? 'text-destructive' : 'text-muted-foreground',
                )} />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setFieldErrors((p) => ({ ...p, email: undefined }))
                    setLoginError(null)
                  }}
                  placeholder="seu@email.com"
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                  className={cn(
                    'w-full h-11 pl-10 pr-3 rounded-xl border bg-background text-foreground text-base',
                    'placeholder:text-muted-foreground/55 outline-none transition-colors',
                    'focus:ring-2 focus:ring-ring focus:border-transparent',
                    'hover:border-border-strong',
                    fieldErrors.email
                      ? 'border-destructive hover:border-destructive focus:ring-destructive/30'
                      : 'border-input',
                  )}
                />
              </div>
              {fieldErrors.email && (
                <p id="email-error" className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <label htmlFor="login-password" className="block text-sm font-medium text-foreground">
                Senha
              </label>
              <div className="relative">
                <Lock className={cn(
                  'absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none transition-colors',
                  fieldErrors.password ? 'text-destructive' : 'text-muted-foreground',
                )} />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setFieldErrors((p) => ({ ...p, password: undefined }))
                    setLoginError(null)
                  }}
                  placeholder="••••••••"
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                  className={cn(
                    'w-full h-11 pl-10 pr-11 rounded-xl border bg-background text-foreground text-base',
                    'placeholder:text-muted-foreground/55 outline-none transition-colors',
                    'focus:ring-2 focus:ring-ring focus:border-transparent',
                    'hover:border-border-strong',
                    fieldErrors.password
                      ? 'border-destructive hover:border-destructive focus:ring-destructive/30'
                      : 'border-input',
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p id="password-error" className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* Remember me + Forgot */}
            <div className="flex items-center justify-between gap-4">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                />
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors select-none">
                  Lembrar-me
                </span>
              </label>
              <Link
                href="/recuperar-senha"
                className="text-sm text-primary hover:opacity-80 transition-opacity shrink-0"
              >
                Esqueci minha senha
              </Link>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              size="lg"
              className={cn(
                'w-full gap-2 transition-all duration-300',
                isSuccess && 'bg-green-600 hover:bg-green-600 border-green-600',
              )}
              disabled={isLoading || isSuccess}
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSuccess && <CheckCircle2 className="h-4 w-4" />}
              {isLoading
                ? 'Entrando…'
                : isSuccess
                ? 'Redirecionando…'
                : 'Entrar'}
            </Button>

          </form>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-3 text-muted-foreground">ou</span>
            </div>
          </div>

          {/* Google OAuth */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading || isLoading || isSuccess}
            className={cn(
              'w-full flex items-center justify-center gap-3 rounded-lg border border-border bg-background px-4 py-2.5',
              'text-sm font-medium text-foreground transition-all duration-150',
              'hover:bg-muted hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:pointer-events-none disabled:opacity-50',
            )}
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            ) : (
              <svg
                className="h-4 w-4 shrink-0"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            {googleLoading ? 'Redirecionando…' : 'Entrar com Google'}
          </button>

        </div>

        {/* Footer */}
        <p
          className="mt-6 text-center text-xs text-muted-foreground animate-fade-up"
          style={{ animationDelay: '200ms' }}
        >
          Cachola OS v{process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0'}
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PAGE — split layout
// ─────────────────────────────────────────────────────────────

export default function LoginPage() {
  return (
    <div className="min-h-svh lg:grid lg:grid-cols-2">
      <BrandingPanel />
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  )
}
