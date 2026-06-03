'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, Plus, AlertCircle, Megaphone, ArrowLeft } from 'lucide-react'
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
import { useCentralServicosAvisos } from '@/hooks/use-central-servicos-avisos'
import { useCentralServicosPermissions } from '@/hooks/use-central-servicos-links'
import {
  AVISO_CATEGORIAS,
  AVISO_CATEGORIA_LABELS,
  CONTATO_UNIDADES,
  CONTATO_UNIDADE_LABELS,
  type CentralServicosAviso,
} from '@/types/central-servicos'
import { AvisoCard } from './aviso-card'
import { AvisoEditSheet } from './aviso-edit-sheet'

type CategoriaFiltro = 'all' | (typeof AVISO_CATEGORIAS)[number]
type UnidadeFiltro = 'all' | (typeof CONTATO_UNIDADES)[number]

export function AvisosClient() {
  const { data: perms } = useCentralServicosPermissions()
  const canCreate = perms?.canCreate ?? false
  const canEdit = perms?.canEdit ?? false
  const canDelete = perms?.canDelete ?? false

  const { data: avisos, isLoading, isError, refetch } = useCentralServicosAvisos()

  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState<CategoriaFiltro>('all')
  const [unidade, setUnidade] = useState<UnidadeFiltro>('all')

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<CentralServicosAviso | null>(null)
  const [createMode, setCreateMode] = useState(false)

  function openCreate() {
    setEditing(null)
    setCreateMode(true)
    setSheetOpen(true)
  }
  function openEdit(a: CentralServicosAviso) {
    setEditing(a)
    setCreateMode(false)
    setSheetOpen(true)
  }

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const list = (avisos ?? []).filter((a) => {
      if (categoria !== 'all' && a.categoria !== categoria) return false
      if (unidade !== 'all' && a.unidade !== unidade) return false
      if (!termo) return true
      return (
        a.titulo.toLowerCase().includes(termo) ||
        a.conteudo.toLowerCase().includes(termo)
      )
    })
    // Prioridade alta primeiro; depois publicado_em desc (a query já vem desc).
    return [...list].sort((a, b) => {
      if (a.prioridade !== b.prioridade) return a.prioridade === 'alta' ? -1 : 1
      return a.publicado_em < b.publicado_em ? 1 : -1
    })
  }, [avisos, busca, categoria, unidade])

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
          title="Mural de Avisos"
          description="Comunicados e avisos internos da empresa."
          actions={
            canCreate ? (
              <Button onClick={openCreate}>
                <Plus className="mr-1.5 h-4 w-4" />
                Novo aviso
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
            placeholder="Buscar por título ou conteúdo…"
            className="pl-9"
          />
        </div>
        <Select value={categoria} onValueChange={(v) => setCategoria(v as CategoriaFiltro)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue>
              {categoria === 'all' ? 'Todas as categorias' : AVISO_CATEGORIA_LABELS[categoria]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {AVISO_CATEGORIAS.map((c) => (
              <SelectItem key={c} value={c}>{AVISO_CATEGORIA_LABELS[c]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={unidade} onValueChange={(v) => setUnidade(v as UnidadeFiltro)}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue>
              {unidade === 'all' ? 'Todas as unidades' : CONTATO_UNIDADE_LABELS[unidade]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as unidades</SelectItem>
            {CONTATO_UNIDADES.map((u) => (
              <SelectItem key={u} value={u}>{CONTATO_UNIDADE_LABELS[u]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Estados */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <AlertCircle className="h-8 w-8 text-status-error-text" />
          <p className="mt-3 text-sm text-muted-foreground">Não foi possível carregar os avisos.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Megaphone className="h-6 w-6 text-primary" />
          </div>
          <p className="mt-4 text-sm font-medium text-foreground">
            {(avisos?.length ?? 0) === 0 ? 'Nenhum aviso publicado' : 'Nenhum aviso encontrado'}
          </p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {(avisos?.length ?? 0) === 0
              ? canCreate
                ? 'Publique o primeiro comunicado da empresa.'
                : 'Os comunicados internos aparecerão aqui.'
              : 'Ajuste a busca ou os filtros.'}
          </p>
          {canCreate && (avisos?.length ?? 0) === 0 && (
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Novo aviso
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map((a) => (
            <AvisoCard key={a.id} aviso={a} canEdit={canEdit} onEdit={openEdit} />
          ))}
        </div>
      )}

      {(canCreate || canEdit) && (
        <AvisoEditSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          aviso={editing}
          createMode={createMode}
          canDelete={canDelete}
        />
      )}
    </div>
  )
}
