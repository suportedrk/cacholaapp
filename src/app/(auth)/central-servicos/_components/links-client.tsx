'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, Plus, AlertCircle, LinkIcon, ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ROUTES } from '@/lib/constants'
import {
  useCentralServicosLinks,
  useCentralServicosPermissions,
} from '@/hooks/use-central-servicos-links'
import {
  LINK_CATEGORIAS,
  LINK_CATEGORIA_LABELS,
  type CentralServicosLink,
} from '@/types/central-servicos'
import { LinkCard } from './link-card'
import { LinkEditSheet } from './link-edit-sheet'

type CategoriaFiltro = 'all' | (typeof LINK_CATEGORIAS)[number]

export function LinksClient() {
  const { data: perms } = useCentralServicosPermissions()
  const canCreate = perms?.canCreate ?? false
  const canEdit = perms?.canEdit ?? false
  const canDelete = perms?.canDelete ?? false

  // Quem pode editar vê também os inativos (esmaecidos); os demais só ativos.
  const { data: links, isLoading, isError, refetch } = useCentralServicosLinks(
    canEdit ? 'todos' : 'ativos',
  )

  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState<CategoriaFiltro>('all')

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<CentralServicosLink | null>(null)
  const [createMode, setCreateMode] = useState(false)

  function openCreate() {
    setEditing(null)
    setCreateMode(true)
    setSheetOpen(true)
  }

  function openEdit(link: CentralServicosLink) {
    setEditing(link)
    setCreateMode(false)
    setSheetOpen(true)
  }

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return (links ?? []).filter((l) => {
      if (categoria !== 'all' && l.categoria !== categoria) return false
      if (!termo) return true
      return (
        l.nome.toLowerCase().includes(termo) ||
        (l.descricao?.toLowerCase().includes(termo) ?? false)
      )
    })
  }, [links, busca, categoria])

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href={ROUTES.centralServicos}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Central de Serviços
        </Link>
        <PageHeader
          title="Links úteis"
          description="Atalhos para os sistemas e portais da empresa."
          actions={
            canCreate ? (
              <Button onClick={openCreate}>
                <Plus className="mr-1.5 h-4 w-4" />
                Novo link
              </Button>
            ) : undefined
          }
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou descrição…"
            className="pl-9"
          />
        </div>
        <Select value={categoria} onValueChange={(v) => setCategoria(v as CategoriaFiltro)}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue>
              {categoria === 'all' ? 'Todas as categorias' : LINK_CATEGORIA_LABELS[categoria]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {LINK_CATEGORIAS.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {LINK_CATEGORIA_LABELS[cat]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Estados */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <AlertCircle className="h-8 w-8 text-status-error-text" />
          <p className="mt-3 text-sm text-muted-foreground">
            Não foi possível carregar os links.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <LinkIcon className="h-6 w-6 text-primary" />
          </div>
          <p className="mt-4 text-sm font-medium text-foreground">
            {(links?.length ?? 0) === 0 ? 'Nenhum link cadastrado' : 'Nenhum link encontrado'}
          </p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {(links?.length ?? 0) === 0
              ? canCreate
                ? 'Cadastre o primeiro atalho para os sistemas da empresa.'
                : 'Os atalhos para os sistemas da empresa aparecerão aqui.'
              : 'Ajuste a busca ou o filtro de categoria.'}
          </p>
          {canCreate && (links?.length ?? 0) === 0 && (
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Novo link
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((link) => (
            <LinkCard key={link.id} link={link} canEdit={canEdit} onEdit={openEdit} />
          ))}
        </div>
      )}

      {(canCreate || canEdit) && (
        <LinkEditSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          link={editing}
          createMode={createMode}
          canDelete={canDelete}
        />
      )}
    </div>
  )
}
