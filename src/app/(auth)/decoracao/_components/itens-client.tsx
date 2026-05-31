'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Image from 'next/image'
import { RefreshCw, AlertCircle, Plus, Search, Boxes, Truck, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/shared/page-header'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { useDecoracaoItens } from '@/hooks/use-decoracao-itens'
import { useDecoracaoCategorias } from '@/hooks/use-decoracao-categorias'
import { useSignedUrls } from '@/hooks/use-signed-urls'
import type { ItemFiltro } from '@/hooks/use-decoracao-itens'
import { DECORACAO_BUCKETS, ROUTES } from '@/lib/constants'
import { cn } from '@/lib/utils'

const TODAS_CATEGORIAS = '__todas__'

const FILTER_OPTIONS: { key: ItemFiltro; label: string }[] = [
  { key: 'ativos', label: 'Ativos' },
  { key: 'inativos', label: 'Inativos' },
  { key: 'todos', label: 'Todos' },
]

const BUCKET = DECORACAO_BUCKETS.itens

export function ItensClient() {
  const router = useRouter()
  const [filtro, setFiltro] = useState<ItemFiltro>('ativos')
  const [search, setSearch] = useState('')
  const [categoriaId, setCategoriaId] = useState<string>(TODAS_CATEGORIAS)

  const { data: itens = [], isLoading, isError, refetch } = useDecoracaoItens(filtro)
  const { data: categorias = [] } = useDecoracaoCategorias('ativos')
  const { isTimedOut, retry } = useLoadingTimeout(isLoading)

  const term = search.trim().toLowerCase()
  const filtered = itens.filter((it) => {
    if (categoriaId !== TODAS_CATEGORIAS && it.categoria_id !== categoriaId) return false
    if (!term) return true
    return it.nome.toLowerCase().includes(term)
  })

  const fotoPaths = filtered.map((i) => i.foto_path).filter((p): p is string => !!p)
  const { data: signedUrls = {} } = useSignedUrls(BUCKET, fotoPaths)

  function openNovo() {
    router.push(ROUTES.decoracaoItemNovo)
  }

  // ── Skeleton ─────────────────────────────────────────────────
  if (isLoading && !isTimedOut) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Itens"
          actions={
            <Button disabled>
              <Plus className="mr-1.5 h-4 w-4" />
              Novo item
            </Button>
          }
        />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="skeleton-shimmer h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  // ── Erro / Timeout ────────────────────────────────────────────
  if (isError || isTimedOut) {
    return (
      <div className="space-y-6">
        <PageHeader title="Itens" />
        <div className="flex flex-col items-center gap-3 rounded-lg border border-status-error-border bg-status-error-bg p-8 text-center text-status-error-text">
          <AlertCircle className="h-8 w-8" />
          <p className="text-sm font-medium">Erro ao carregar itens.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void (isTimedOut ? retry() : refetch())
            }}
          >
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Itens"
        actions={
          <Button onClick={openNovo}>
            <Plus className="mr-1.5 h-4 w-4" />
            Novo item
          </Button>
        }
      />

      {/* Filtros + Busca */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-1.5">
          {FILTER_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFiltro(key)}
              className={cn(
                'rounded-full px-3 py-1 text-sm font-medium transition-colors',
                filtro === key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Filtro por categoria */}
        <Select value={categoriaId} onValueChange={(v) => setCategoriaId(v || TODAS_CATEGORIAS)}>
          <SelectTrigger className="sm:max-w-[200px]">
            <SelectValue>
              {categoriaId === TODAS_CATEGORIAS
                ? 'Todas as categorias'
                : categorias.find((c) => c.id === categoriaId)?.nome ?? 'Todas as categorias'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS_CATEGORIAS}>Todas as categorias</SelectItem>
            {categorias.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <Boxes className="h-10 w-10 opacity-30" />
          <p className="text-sm">
            {search
              ? 'Nenhum item encontrado para essa busca.'
              : filtro === 'inativos'
                ? 'Nenhum item inativo.'
                : 'Nenhum item cadastrado ainda.'}
          </p>
          {!search && filtro === 'ativos' && (
            <Button variant="outline" size="sm" onClick={openNovo}>
              <Plus className="mr-1.5 h-4 w-4" />
              Cadastrar primeiro item
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((it) => {
            const thumbUrl = it.foto_path ? signedUrls[it.foto_path] : null
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => router.push(`${ROUTES.decoracaoItens}/${it.id}`)}
                  className="w-full rounded-lg border border-border-default bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center gap-3">
                    {/* Thumb */}
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border-default bg-muted/30">
                      {thumbUrl ? (
                        <Image
                          src={thumbUrl}
                          alt={it.nome}
                          width={56}
                          height={56}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-text-tertiary">
                          <Boxes className="h-6 w-6" />
                        </div>
                      )}
                    </div>

                    {/* Conteúdo */}
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium">{it.nome}</span>
                        {it.categoria_nome && (
                          <Badge variant="default" className="shrink-0 text-xs">
                            <Tag className="mr-1 h-3 w-3" />
                            {it.categoria_nome}
                          </Badge>
                        )}
                        <Badge
                          variant={it.origem === 'acervo' ? 'secondary' : 'outline'}
                          className="shrink-0 text-xs"
                        >
                          {it.origem === 'acervo' ? 'Acervo' : 'Fornecedor'}
                        </Badge>
                        {!it.ativo && (
                          <Badge variant="outline" className="shrink-0 text-xs">
                            Inativo
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        {it.origem === 'fornecedor' && it.fornecedor_nome && (
                          <span className="flex items-center gap-1">
                            <Truck className="h-3 w-3 shrink-0" />
                            {it.fornecedor_nome}
                          </span>
                        )}
                        <span>
                          {it.variacoes_count}{' '}
                          {it.variacoes_count === 1 ? 'variação' : 'variações'}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
