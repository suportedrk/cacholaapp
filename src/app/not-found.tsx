'use client'

import Link from 'next/link'
import { Home, Compass } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-sm animate-page-enter">
        {/* Ícone decorativo */}
        <div className="flex justify-center mb-6">
          <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-muted">
            <Compass className="w-10 h-10 text-muted-foreground" strokeWidth={1.5} />
          </div>
        </div>

        {/* Número 404 */}
        <p className="text-8xl font-bold leading-none mb-4 text-primary/20 select-none">
          404
        </p>

        <h1 className="text-xl font-semibold text-foreground mb-2">
          Página não encontrada
        </h1>
        <p className="text-sm text-muted-foreground mb-8 max-w-xs mx-auto">
          A página que você está procurando não existe ou foi movida para outro endereço.
        </p>

        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: 'default', size: 'default' }))}
        >
          <Home className="w-4 h-4 mr-2" />
          Voltar ao Dashboard
        </Link>
      </div>
    </div>
  )
}
