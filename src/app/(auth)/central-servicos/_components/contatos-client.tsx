'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, Plus, AlertCircle, Users, ArrowLeft, Mail, MessageCircle, Pencil } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { buttonVariants } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/lib/constants'
import { useSignedUrls } from '@/hooks/use-signed-urls'
import { useCentralServicosContatos } from '@/hooks/use-central-servicos-contatos'
import { useCentralServicosPermissions } from '@/hooks/use-central-servicos-links'
import {
  CONTATO_UNIDADES,
  CONTATO_UNIDADE_LABELS,
  CONTATOS_BUCKET,
  buildWhatsappUrl,
  type CentralServicosContato,
} from '@/types/central-servicos'
import { ContatoAvatar } from './contato-avatar'
import { ContatoCard } from './contato-card'
import { ContatoEditSheet } from './contato-edit-sheet'

type UnidadeFiltro = 'all' | (typeof CONTATO_UNIDADES)[number]

export function ContatosClient() {
  const { data: perms } = useCentralServicosPermissions()
  const canCreate = perms?.canCreate ?? false
  const canEdit = perms?.canEdit ?? false
  const canDelete = perms?.canDelete ?? false

  const { data: contatos, isLoading, isError, refetch } = useCentralServicosContatos()

  const [busca, setBusca] = useState('')
  const [unidade, setUnidade] = useState<UnidadeFiltro>('all')

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<CentralServicosContato | null>(null)
  const [createMode, setCreateMode] = useState(false)

  // Signed URLs em batch para todas as fotos.
  const fotoPaths = useMemo(
    () => (contatos ?? []).map((c) => c.foto_path).filter((p): p is string => !!p),
    [contatos],
  )
  const { data: signedUrls = {} } = useSignedUrls(CONTATOS_BUCKET, fotoPaths)

  function openCreate() {
    setEditing(null)
    setCreateMode(true)
    setSheetOpen(true)
  }
  function openEdit(c: CentralServicosContato) {
    setEditing(c)
    setCreateMode(false)
    setSheetOpen(true)
  }

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return (contatos ?? []).filter((c) => {
      if (unidade !== 'all' && c.unidade !== unidade) return false
      if (!termo) return true
      return (
        c.nome.toLowerCase().includes(termo) ||
        (c.setor?.toLowerCase().includes(termo) ?? false) ||
        (c.cargo?.toLowerCase().includes(termo) ?? false)
      )
    })
  }, [contatos, busca, unidade])

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
          title="Agenda de Contatos"
          description="Contatos das pessoas e setores da empresa."
          actions={
            canCreate ? (
              <Button onClick={openCreate}>
                <Plus className="mr-1.5 h-4 w-4" />
                Novo contato
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
            placeholder="Buscar por nome, setor ou cargo…"
            className="pl-9"
          />
        </div>
        <Select value={unidade} onValueChange={(v) => setUnidade(v as UnidadeFiltro)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue>
              {unidade === 'all' ? 'Todas as unidades' : CONTATO_UNIDADE_LABELS[unidade]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as unidades</SelectItem>
            {CONTATO_UNIDADES.map((u) => (
              <SelectItem key={u} value={u}>
                {CONTATO_UNIDADE_LABELS[u]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Estados */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <AlertCircle className="h-8 w-8 text-status-error-text" />
          <p className="mt-3 text-sm text-muted-foreground">Não foi possível carregar os contatos.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <p className="mt-4 text-sm font-medium text-foreground">
            {(contatos?.length ?? 0) === 0 ? 'Nenhum contato cadastrado' : 'Nenhum contato encontrado'}
          </p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {(contatos?.length ?? 0) === 0
              ? canCreate
                ? 'Cadastre o primeiro contato da empresa.'
                : 'Os contatos da empresa aparecerão aqui.'
              : 'Ajuste a busca ou o filtro de unidade.'}
          </p>
          {canCreate && (contatos?.length ?? 0) === 0 && (
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Novo contato
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filtrados.map((c) => (
              <ContatoCard
                key={c.id}
                contato={c}
                signedUrl={c.foto_path ? signedUrls[c.foto_path] : undefined}
                canEdit={canEdit}
                onEdit={openEdit}
              />
            ))}
          </div>

          {/* Desktop: tabela */}
          <div className="hidden overflow-hidden rounded-xl border border-border md:block">
            <table className="w-full text-sm">
              <thead className="bg-surface-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Pessoa</th>
                  <th className="px-4 py-3 font-medium">Setor</th>
                  <th className="px-4 py-3 font-medium">Unidade</th>
                  <th className="px-4 py-3 font-medium">Contato</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtrados.map((c) => {
                  const whatsapp = buildWhatsappUrl(c.telefone)
                  return (
                    <tr key={c.id} className={cn('hover:bg-muted/40', !c.ativo && 'opacity-60')}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <ContatoAvatar
                            src={c.foto_path ? signedUrls[c.foto_path] : undefined}
                            nome={c.nome}
                            size={40}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-medium text-foreground">{c.nome}</span>
                              {!c.ativo && <Badge variant="secondary">Inativo</Badge>}
                            </div>
                            {c.cargo && (
                              <span className="truncate text-xs text-muted-foreground">{c.cargo}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{c.setor ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{CONTATO_UNIDADE_LABELS[c.unidade]}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {c.email ? (
                            <a
                              href={`mailto:${c.email}`}
                              className="inline-flex items-center gap-1.5 text-text-link hover:underline"
                            >
                              <Mail className="h-4 w-4" />
                              <span className="truncate">{c.email}</span>
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                          {whatsapp && (
                            <a
                              href={whatsapp}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(buttonVariants({ size: 'xs', variant: 'outline' }))}
                              aria-label={`WhatsApp de ${c.nome}`}
                            >
                              <MessageCircle className="mr-1 h-3.5 w-3.5" />
                              WhatsApp
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canEdit && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(c)}
                            aria-label={`Editar ${c.nome}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(canCreate || canEdit) && (
        <ContatoEditSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          contato={editing}
          createMode={createMode}
          canDelete={canDelete}
        />
      )}
    </div>
  )
}
