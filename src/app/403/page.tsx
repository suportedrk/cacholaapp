import Link from 'next/link'
import { ShieldX } from 'lucide-react'

/**
 * Página 403 — Acesso Negado
 *
 * Destino de redirect quando o role do usuário não tem permissão
 * para acessar uma rota protegida (layouts de Server Component).
 */
export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <span className="icon-brand rounded-full p-4">
        <ShieldX className="h-10 w-10" />
      </span>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-text-primary">
          Acesso negado
        </h1>
        <p className="text-text-secondary max-w-sm">
          Você não tem permissão para acessar esta página. Se acredita que isso é
          um erro, fale com o administrador do sistema.
        </p>
      </div>

      <Link
        href="/dashboard"
        className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        Voltar ao início
      </Link>
    </div>
  )
}
