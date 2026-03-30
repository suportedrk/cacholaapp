'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useProvider, useProviderEvents } from '@/hooks/use-providers'
import { ProviderDetailHeader } from './components/ProviderDetailHeader'
import { ProviderQuickActions } from './components/ProviderQuickActions'
import { GeneralInfoSection } from './components/sections/GeneralInfoSection'
import { ContactsSection } from './components/sections/ContactsSection'
import { ServicesSection } from './components/sections/ServicesSection'
import { DocumentsSection } from './components/sections/DocumentsSection'
import { EventHistorySection } from './components/sections/EventHistorySection'
import { RatingsSection } from './components/sections/RatingsSection'
import { NotesSection } from './components/sections/NotesSection'

export default function PrestadorDetalhePage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === 'string' ? params.id : ''

  const { data: provider, isLoading, isError, refetch } = useProvider(id)
  const { data: eventProviders = [] } = useProviderEvents(id)

  if (isLoading) {
    return (
      <div className="max-w-3xl space-y-4 pb-24 md:pb-0">
        {/* Header skeleton */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Skeleton className="w-14 h-14 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="h-3.5 w-28" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3.5 w-56" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </div>
        {/* Accordion skeleton */}
        <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 px-4 py-3.5">
              <Skeleton className="w-4 h-4 rounded" />
              <Skeleton className="h-4 flex-1 max-w-32" />
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-4 w-4 rounded" />
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

  const ratings = provider.ratings ?? []
  const services = (provider.services ?? []) as Parameters<typeof ServicesSection>[0]['services']

  return (
    <div className="max-w-3xl space-y-4 pb-24 md:pb-0">
      {/* Breadcrumb (desktop) */}
      <nav className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/prestadores" className="hover:text-foreground transition-colors">
          Prestadores
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium truncate max-w-[200px]">
          {provider.name}
        </span>
      </nav>

      {/* Back link (mobile) */}
      <Link
        href="/prestadores"
        className="md:hidden inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Prestadores
      </Link>

      {/* Header */}
      <ProviderDetailHeader provider={provider} />

      {/* Accordion sections */}
      <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
        <GeneralInfoSection provider={provider} />
        <ContactsSection contacts={provider.contacts ?? []} />
        <ServicesSection services={services} />
        <DocumentsSection documents={provider.documents ?? []} />
        <EventHistorySection
          eventProviders={eventProviders}
          ratings={ratings}
        />
        <RatingsSection ratings={ratings} avgRating={provider.avg_rating} />
        <NotesSection provider={provider} />
      </div>

      {/* Mobile quick actions */}
      <ProviderQuickActions provider={provider} />
    </div>
  )
}
