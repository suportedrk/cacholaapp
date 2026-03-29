'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { SupplierForm } from '@/components/features/maintenance/supplier-form'

export default function NovoFornecedorPage() {
  const router = useRouter()

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back link */}
      <Link
        href="/manutencao?tab=suppliers"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Fornecedores
      </Link>

      <PageHeader
        title="Novo Fornecedor"
        description="Cadastre uma empresa prestadora de serviços de manutenção"
      />

      <div className="bg-card rounded-xl border border-border p-6">
        <SupplierForm
          onSuccess={(id) => router.push(`/manutencao/fornecedores/${id}`)}
          onCancel={() => router.push('/manutencao?tab=suppliers')}
        />
      </div>
    </div>
  )
}
