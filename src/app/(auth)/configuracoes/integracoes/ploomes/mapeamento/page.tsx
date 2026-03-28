'use client'

import { ArrowLeft, MapPin } from 'lucide-react'
import Link from 'next/link'
import { useUnitStore } from '@/stores/unit-store'
import { usePloomesConfig } from '@/hooks/use-ploomes-sync'
import { PageHeader } from '@/components/shared/page-header'
import { MappingPipelineCard } from '@/components/features/ploomes/mapping-pipeline-card'
import { MappingFieldCard } from '@/components/features/ploomes/mapping-field-card'
import { MappingContactCard } from '@/components/features/ploomes/mapping-contact-card'
import { MappingStatusCard } from '@/components/features/ploomes/mapping-status-card'

// ── Skeleton de seção ─────────────────────────────────────────

function SectionSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden animate-pulse">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-secondary/30">
        <div className="h-8 w-8 rounded-lg bg-muted" />
        <div className="space-y-1.5">
          <div className="h-3.5 w-32 rounded bg-muted" />
          <div className="h-3 w-48 rounded bg-muted" />
        </div>
      </div>
      <div className="divide-y divide-border">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex justify-between items-center px-5 py-3">
            <div className="h-3 w-28 rounded bg-muted" />
            <div className="h-3 w-20 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────

export default function PloomesFieldMappingPage() {
  const { activeUnitId } = useUnitStore()
  const { data: config, isLoading, isError } = usePloomesConfig(activeUnitId)

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/configuracoes" className="hover:text-foreground transition-colors">
          Configurações
        </Link>
        <span>/</span>
        <Link
          href="/configuracoes/integracoes/ploomes"
          className="hover:text-foreground transition-colors"
        >
          Ploomes CRM
        </Link>
        <span>/</span>
        <span className="text-foreground">Mapeamento</span>
      </div>

      {/* Voltar */}
      <Link
        href="/configuracoes/integracoes/ploomes"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Ploomes CRM
      </Link>

      <PageHeader
        title="Mapeamento de Campos"
        description="Visualize como os dados do Ploomes CRM são mapeados para o Cachola OS."
      />

      {/* Erro */}
      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Erro ao carregar configuração. Verifique se a integração está configurada.
        </div>
      )}

      {/* Config não encontrada */}
      {!isLoading && !isError && !config && (
        <div className="rounded-xl border border-border bg-card px-5 py-8 text-center shadow-sm">
          <MapPin className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">Configuração não encontrada</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Execute a migration 015 e faça o primeiro sync para gerar a configuração padrão.
          </p>
        </div>
      )}

      {/* Seções de mapeamento */}
      {isLoading && (
        <>
          <SectionSkeleton />
          <SectionSkeleton />
          <SectionSkeleton />
          <SectionSkeleton />
        </>
      )}

      {config && (
        <div className="space-y-4">
          {/* 1. Pipeline / Funil */}
          <MappingPipelineCard config={config} />

          {/* 2. Campos da Festa */}
          <MappingFieldCard config={config} />

          {/* 3. Dados do Cliente */}
          <MappingContactCard config={config} />

          {/* 4. Status do Deal */}
          <MappingStatusCard config={config} />
        </div>
      )}

      {/* Nota de rodapé */}
      {config && (
        <p className="text-xs text-muted-foreground text-center pb-2">
          Para alterar os mapeamentos, edite a tabela{' '}
          <code className="rounded bg-muted px-1 py-0.5 font-mono">ploomes_config</code>{' '}
          no banco ou entre em contato com o administrador do sistema.
        </p>
      )}
    </div>
  )
}
