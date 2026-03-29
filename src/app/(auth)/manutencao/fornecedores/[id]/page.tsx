'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Building2, Users, FileText, Pencil,
  Trash2, Check, X as XIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { SupplierRating } from '@/components/features/maintenance/supplier-rating'
import { SupplierForm } from '@/components/features/maintenance/supplier-form'
import { ContactList } from '@/components/features/maintenance/contact-list'
import { SupplierDocumentSection } from '@/components/features/maintenance/supplier-document-section'
import { useSupplier, useDeleteSupplier } from '@/hooks/use-suppliers'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────
// SECTION WRAPPER
// ─────────────────────────────────────────────────────────────
function Section({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: React.ElementType
  title: string
  count?: number
  children: React.ReactNode
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {count !== undefined && (
          <span className="ml-auto text-xs badge-gray border px-2 py-0.5 rounded-full">
            {count}
          </span>
        )}
      </div>
      <Separator />
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────
export default function FornecedorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router  = useRouter()
  const [editingCompany, setEditingCompany] = useState(false)

  const { data: supplier, isLoading, isError } = useSupplier(id)
  const deleteSupplier = useDeleteSupplier()

  // ── Loading ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-64" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-5 space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-px w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────
  if (isError || !supplier) {
    return (
      <div className="space-y-4 max-w-3xl">
        <Link
          href="/manutencao?tab=suppliers"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Fornecedores
        </Link>
        <p className="text-sm text-destructive">Fornecedor não encontrado ou sem permissão.</p>
      </div>
    )
  }

  // ── Content ────────────────────────────────────────────────
  const displayName = supplier.trade_name ?? supplier.company_name

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back */}
      <Link
        href="/manutencao?tab=suppliers"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Fornecedores
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-700 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{displayName}</h1>
            {supplier.trade_name && supplier.trade_name !== supplier.company_name && (
              <p className="text-sm text-muted-foreground">{supplier.company_name}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-1">
              {supplier.rating != null && (
                <SupplierRating value={supplier.rating} size="sm" />
              )}
              {supplier.category && (
                <span className="text-xs badge-gray border px-2 py-0.5 rounded-full">
                  {supplier.category}
                </span>
              )}
              {!supplier.is_active && (
                <span className="text-xs badge-gray border px-2 py-0.5 rounded-full">
                  Inativo
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Delete */}
        <ConfirmDialog
          title="Remover fornecedor"
          description={`Tem certeza que deseja remover "${supplier.company_name}"? Todos os contatos e documentos serão removidos.`}
          destructive
          onConfirm={async () => {
            await deleteSupplier.mutateAsync(id)
            router.push('/manutencao?tab=suppliers')
          }}
          trigger={
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive shrink-0">
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline ml-1.5">Remover</span>
            </Button>
          }
        />
      </div>

      {/* ── Section 1: Company Info ──────────────────────────── */}
      <Section icon={Building2} title="Dados da Empresa">
        {editingCompany ? (
          <SupplierForm
            supplier={supplier}
            onSuccess={() => setEditingCompany(false)}
            onCancel={() => setEditingCompany(false)}
          />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <InfoRow label="Razão Social" value={supplier.company_name} />
              {supplier.trade_name && (
                <InfoRow label="Nome Fantasia" value={supplier.trade_name} />
              )}
              {supplier.cnpj && (
                <InfoRow label="CNPJ" value={supplier.cnpj} mono />
              )}
              {supplier.category && (
                <InfoRow label="Categoria" value={supplier.category} />
              )}
              {supplier.phone && (
                <InfoRow label="Telefone" value={supplier.phone} />
              )}
              {supplier.email && (
                <InfoRow label="E-mail" value={supplier.email} />
              )}
              {supplier.address && (
                <InfoRow label="Endereço" value={supplier.address} className="sm:col-span-2" />
              )}
              {supplier.notes && (
                <InfoRow label="Observações" value={supplier.notes} className="sm:col-span-2" />
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Status</p>
                <span className={cn(
                  'inline-flex items-center gap-1 text-sm font-medium',
                  supplier.is_active ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground',
                )}>
                  {supplier.is_active
                    ? <><Check className="w-3.5 h-3.5" />Ativo</>
                    : <><XIcon className="w-3.5 h-3.5" />Inativo</>}
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingCompany(true)}
              className="gap-1.5"
            >
              <Pencil className="w-3.5 h-3.5" />
              Editar dados
            </Button>
          </div>
        )}
      </Section>

      {/* ── Section 2: Contacts ──────────────────────────────── */}
      <Section icon={Users} title="Contatos" count={supplier.contacts.length}>
        <ContactList supplierId={supplier.id} contacts={supplier.contacts} />
      </Section>

      {/* ── Section 3: Documents ─────────────────────────────── */}
      <Section icon={FileText} title="Documentos" count={supplier.documents.length}>
        <SupplierDocumentSection
          supplierId={supplier.id}
          documents={supplier.documents}
        />
      </Section>
    </div>
  )
}

function InfoRow({
  label,
  value,
  mono,
  className,
}: {
  label: string
  value: string
  mono?: boolean
  className?: string
}) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className={cn('text-sm text-foreground', mono && 'font-mono')}>{value}</p>
    </div>
  )
}
