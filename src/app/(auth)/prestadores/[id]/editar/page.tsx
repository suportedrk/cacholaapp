'use client'

import { useParams, useRouter } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { useProvider } from '@/hooks/use-providers'
import { ProviderForm } from '../../components/ProviderForm'

export default function EditarPrestadorPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === 'string' ? params.id : ''

  const { data: provider, isLoading, isError, refetch } = useProvider(id)

  if (isLoading) {
    return (
      <div className="max-w-3xl space-y-6">
        {/* Header */}
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-64" />
        </div>
        {/* Stepper */}
        <div className="flex items-center gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Skeleton className="w-8 h-8 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
        {/* Card */}
        <div className="rounded-xl border border-border p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (isError || !provider) {
    return (
      <div className="max-w-3xl flex flex-col items-center justify-center py-16 gap-4 text-center">
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar o prestador. Verifique sua conexão.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => refetch()}
            className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Tentar novamente
          </button>
          <button
            onClick={() => router.push('/prestadores')}
            className="h-9 px-4 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Voltar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-0">
      <div className="mb-2">
        <h1 className="text-xl font-semibold text-foreground">Editar Prestador</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {provider.name}
        </p>
      </div>
      <ProviderForm provider={provider} />
    </div>
  )
}
