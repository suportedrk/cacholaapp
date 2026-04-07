'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SetupSenhaPage() {
  const router = useRouter()
  const [password, setPassword]         = useState('')
  const [confirm, setConfirm]           = useState('')
  const [showPass, setShowPass]         = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)
  const [isPending, setIsPending]       = useState(false)
  const [isDone, setIsDone]             = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [userName, setUserName]         = useState<string | null>(null)

  // Carregar nome do usuário logado
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const name = data.user.user_metadata?.name as string | undefined
        setUserName(name?.split(' ')[0] ?? null)
      }
    })
  }, [])

  const strengthScore = (() => {
    if (!password) return 0
    let s = 0
    if (password.length >= 8)  s++
    if (password.length >= 12) s++
    if (/[A-Z]/.test(password)) s++
    if (/[0-9]/.test(password)) s++
    if (/[^A-Za-z0-9]/.test(password)) s++
    return s
  })()

  const strengthLabel = ['', 'Fraca', 'Fraca', 'Razoável', 'Boa', 'Forte'][strengthScore]
  const strengthColor = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500', 'bg-green-600'][strengthScore]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }

    setIsPending(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        setError('Não foi possível definir a senha. Tente novamente.')
        return
      }

      setIsDone(true)
      // Redirecionar para o dashboard após 2s
      setTimeout(() => router.push('/dashboard'), 2000)
    } catch {
      setError('Erro inesperado. Tente novamente.')
    } finally {
      setIsPending(false)
    }
  }

  if (isDone) {
    return (
      <div className="min-h-svh flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4 animate-fade-up">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Senha definida!</h1>
          <p className="text-muted-foreground">Redirecionando para o sistema…</p>
          <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-svh flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6 animate-fade-up">

        {/* Logo + saudação */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto shadow-md">
            <span className="text-2xl font-bold text-primary-foreground">C</span>
          </div>
          <h1 className="text-2xl font-semibold text-foreground">
            {userName ? `Olá, ${userName}!` : 'Bem-vindo!'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Defina uma senha para acessar o <span className="font-medium text-foreground">Cachola OS</span>
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border p-6 space-y-4 shadow-sm">

          {/* Senha */}
          <div className="space-y-1.5">
            <Label htmlFor="password">Nova senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="pl-9 pr-10"
                autoFocus
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Barra de força */}
            {password.length > 0 && (
              <div className="space-y-1">
                <div className="flex gap-1 h-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-full transition-all duration-300 ${
                        i <= strengthScore ? strengthColor : 'bg-border'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Força: <span className="font-medium">{strengthLabel}</span>
                </p>
              </div>
            )}
          </div>

          {/* Confirmar senha */}
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirmar senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="confirm"
                type={showConfirm ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repita a senha"
                className="pl-9 pr-10"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={showConfirm ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirm.length > 0 && password !== confirm && (
              <p className="text-xs text-destructive">As senhas não coincidem</p>
            )}
          </div>

          {/* Erro */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isPending || password.length < 8 || password !== confirm}
          >
            {isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando…</>
            ) : (
              'Definir senha e entrar'
            )}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Cachola OS v{process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0'}
        </p>
      </div>
    </div>
  )
}
