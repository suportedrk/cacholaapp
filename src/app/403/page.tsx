import Link from 'next/link'
import { ShieldX } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'

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

      <Link href="/dashboard" className={buttonVariants({ variant: 'outline' })}>
        Voltar ao início
      </Link>
    </div>
  )
}
