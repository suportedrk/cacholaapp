'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Plus, AlertCircle, Loader2, Trash2, Package, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/shared/page-header'
import { PhotoDropZone, PhotoThumb } from '@/components/shared/photo-upload'
import { useSignedUrls } from '@/hooks/use-signed-urls'
import { useDecoracaoFornecedores } from '@/hooks/use-decoracao-fornecedores'
import { useDecoracaoCategorias } from '@/hooks/use-decoracao-categorias'
import {
  useDecoracaoItem,
  useCreateItem,
  useUpdateItem,
  useDeleteItem,
} from '@/hooks/use-decoracao-itens'
import { hasRole, DECORACAO_DELETE_ROLES } from '@/config/roles'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { useDecoracaoEstoquePorItem } from '@/hooks/use-decoracao-estoque'
import { DECORACAO_BUCKETS, ROUTES } from '@/lib/constants'
import { parseMoney, moneyDisplay } from '@/lib/utils/money-br'
import { cn } from '@/lib/utils'
import { VariacaoCard } from './variacao-card'
import type {
  DecoracaoItemOrigem,
  ItemFormInput,
  VariacaoFormInput,
} from '@/types/decoracao'

const BUCKET = DECORACAO_BUCKETS.itens

interface Props {
  mode: 'create' | 'edit'
  itemId?: string
}

function newEmptyVariacao(ordem: number): VariacaoFormInput {
  return { tamanho: null, cor: null, detalhe: null, ordem, foto_path: null }
}

async function removeFromStorage(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  try {
    const supabase = createClient()
    await supabase.storage.from(BUCKET).remove(paths)
  } catch {
    // fire-and-forget
  }
}

function isVariacaoValida(v: VariacaoFormInput): boolean {
  return Boolean(v.tamanho?.trim() || v.cor?.trim() || v.detalhe?.trim())
}

export function ItemEditor({ mode, itemId }: Props) {
  const router = useRouter()
  const { profile } = useAuth()
  const canDelete = hasRole(profile?.role, DECORACAO_DELETE_ROLES)

  const detailQuery = useDecoracaoItem(mode === 'edit' ? itemId ?? null : null)
  const createMutation = useCreateItem()
  const updateMutation = useUpdateItem()
  const deleteMutation = useDeleteItem()

  const { data: fornecedores = [] } = useDecoracaoFornecedores('ativos')
  const { data: categorias = [] } = useDecoracaoCategorias('ativos')
  const { data: estoquePorItem = [] } = useDecoracaoEstoquePorItem(
    mode === 'edit' ? itemId : undefined,
  )

  const [form, setForm] = useState<ItemFormInput>({
    nome: '',
    origem: 'acervo',
    fornecedor_id: null,
    categoria_id: null,
    preco_custo: 0,
    preco_venda: 0,
    foto_path: null,
    observacoes: null,
    ativo: true,
    variacoes: [newEmptyVariacao(0)],
  })
  /** Strings cruas dos inputs de preço (formato BR), separadas do number do form. */
  const [custoRaw, setCustoRaw] = useState('')
  const [vendaRaw, setVendaRaw] = useState('')
  /** Mapa de codigos reais por índice da variação (para edição). Variações novas não têm. */
  const [codigos, setCodigos] = useState<Record<number, string>>({})
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const pendingUploadsRef = useRef<string[]>([])

  // Agrega todos os paths de foto (item + variações) numa única chamada de signed URLs
  const allFotoPaths = [
    ...(form.foto_path ? [form.foto_path] : []),
    ...form.variacoes.flatMap((v) => (v.foto_path ? [v.foto_path] : [])),
  ]
  const { data: signedUrls = {} } = useSignedUrls(BUCKET, allFotoPaths)

  // Hidrata form em edit
  useEffect(() => {
    if (mode !== 'edit') return
    if (!detailQuery.data) return
    /* eslint-disable react-hooks/set-state-in-effect -- sincroniza props→form */
    const d = detailQuery.data
    setForm({
      nome: d.nome,
      origem: d.origem,
      fornecedor_id: d.fornecedor_id,
      categoria_id: d.categoria_id,
      preco_custo: d.preco_custo,
      preco_venda: d.preco_venda,
      foto_path: d.foto_path,
      observacoes: d.observacoes,
      ativo: d.ativo,
      variacoes: d.variacoes.map((v) => ({
        id: v.id,
        tamanho: v.tamanho,
        cor: v.cor,
        detalhe: v.detalhe,
        ordem: v.ordem,
        foto_path: v.foto_path ?? null,
      })),
    })
    setCustoRaw(moneyDisplay(d.preco_custo))
    setVendaRaw(moneyDisplay(d.preco_venda))
    setCodigos(
      Object.fromEntries(d.variacoes.map((v, i) => [i, v.codigo])),
    )
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [mode, detailQuery.data?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  // ─── Foto handlers ──────────────────────────────────────────
  function handleFotoUpload(storagePath: string): Promise<void> {
    setForm((f) => ({ ...f, foto_path: storagePath }))
    pendingUploadsRef.current = [...pendingUploadsRef.current, storagePath]
    return Promise.resolve()
  }

  function handleFotoRemove() {
    setForm((f) => ({ ...f, foto_path: null }))
  }

  function discardPendingUploads() {
    const toClean = pendingUploadsRef.current
    pendingUploadsRef.current = []
    if (toClean.length > 0) void removeFromStorage(toClean)
  }

  // ─── Foto por variação ─────────────────────────────────────
  function handleVariacaoFotoUpload(index: number, path: string): void {
    setForm((f) => ({
      ...f,
      variacoes: f.variacoes.map((v, i) => (i === index ? { ...v, foto_path: path } : v)),
    }))
    pendingUploadsRef.current = [...pendingUploadsRef.current, path]
  }

  function handleVariacaoFotoRemove(index: number): void {
    setForm((f) => ({
      ...f,
      variacoes: f.variacoes.map((v, i) => (i === index ? { ...v, foto_path: null } : v)),
    }))
  }

  // ─── Variações handlers ────────────────────────────────────
  function addVariacao() {
    setForm((f) => ({
      ...f,
      variacoes: [...f.variacoes, newEmptyVariacao(f.variacoes.length)],
    }))
  }

  function updateVariacao(index: number, next: VariacaoFormInput) {
    setForm((f) => ({
      ...f,
      variacoes: f.variacoes.map((v, i) => (i === index ? next : v)),
    }))
  }

  function removeVariacao(index: number) {
    setForm((f) => ({
      ...f,
      variacoes: f.variacoes.filter((_, i) => i !== index).map((v, i) => ({ ...v, ordem: i })),
    }))
    setCodigos((map) => {
      const next: Record<number, string> = {}
      Object.entries(map).forEach(([k, v]) => {
        const i = Number(k)
        if (i < index) next[i] = v
        else if (i > index) next[i - 1] = v
      })
      return next
    })
  }

  // ─── Submit ─────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const nome = form.nome.trim()
    if (!nome) return
    if (!form.categoria_id) return
    if (form.origem === 'fornecedor' && !form.fornecedor_id) return
    if (form.variacoes.length === 0) return
    if (!form.variacoes.every(isVariacaoValida)) return

    const payload: ItemFormInput = {
      nome,
      origem: form.origem,
      fornecedor_id: form.origem === 'fornecedor' ? form.fornecedor_id : null,
      categoria_id: form.categoria_id,
      preco_custo: parseMoney(custoRaw) ?? 0,
      preco_venda: parseMoney(vendaRaw) ?? 0,
      foto_path: form.foto_path,
      observacoes: form.observacoes?.trim() || null,
      ativo: form.ativo,
      variacoes: form.variacoes.map((v, i) => ({
        ...v,
        tamanho: v.tamanho?.trim() || null,
        cor: v.cor?.trim() || null,
        detalhe: v.detalhe?.trim() || null,
        ordem: i,
      })),
    }

    try {
      let newId: string
      if (mode === 'create') {
        newId = await createMutation.mutateAsync(payload)
      } else {
        await updateMutation.mutateAsync({ id: itemId!, input: payload })
        newId = itemId!
      }

      // Sucesso: limpa órfãos (item + variações)
      const originalFotoPath = detailQuery.data?.foto_path ?? null
      const savedVariacaoPaths = new Set(
        form.variacoes.flatMap((v) => (v.foto_path ? [v.foto_path] : [])),
      )
      const orphans: string[] = []
      for (const p of pendingUploadsRef.current) {
        if (p !== form.foto_path && !savedVariacaoPaths.has(p)) orphans.push(p)
      }
      if (originalFotoPath && originalFotoPath !== form.foto_path) orphans.push(originalFotoPath)
      // Fotos de variações que foram removidas durante a edição
      if (detailQuery.data) {
        for (const orig of detailQuery.data.variacoes) {
          if (orig.foto_path && !savedVariacaoPaths.has(orig.foto_path)) {
            orphans.push(orig.foto_path)
          }
        }
      }
      pendingUploadsRef.current = []
      void removeFromStorage(orphans)

      router.push(mode === 'create' ? `${ROUTES.decoracaoItens}/${newId}` : ROUTES.decoracaoItens)
    } catch {
      // toast já disparado pela mutation
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      return
    }
    if (!itemId) return
    try {
      await deleteMutation.mutateAsync(itemId)
      const toClean: string[] = []
      if (detailQuery.data?.foto_path) toClean.push(detailQuery.data.foto_path)
      for (const v of detailQuery.data?.variacoes ?? []) {
        if (v.foto_path) toClean.push(v.foto_path)
      }
      pendingUploadsRef.current.forEach((p) => {
        if (p !== detailQuery.data?.foto_path) toClean.push(p)
      })
      pendingUploadsRef.current = []
      void removeFromStorage(toClean)
      router.push(ROUTES.decoracaoItens)
    } catch {
      // toast
    }
  }

  function handleCancel() {
    discardPendingUploads()
    router.push(ROUTES.decoracaoItens)
  }

  // ─── Estados ────────────────────────────────────────────────
  if (mode === 'edit' && detailQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Editar item" />
        <Skeleton className="skeleton-shimmer h-64 w-full rounded-lg" />
      </div>
    )
  }

  if (mode === 'edit' && detailQuery.isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Editar item" />
        <div className="flex flex-col items-center gap-3 rounded-lg border border-status-error-border bg-status-error-bg p-8 text-center text-status-error-text">
          <AlertCircle className="h-8 w-8" />
          <p className="text-sm font-medium">Erro ao carregar item.</p>
          <Button variant="outline" size="sm" onClick={() => detailQuery.refetch()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  // ─── Validações para o botão Salvar ────────────────────────
  const nomeValido = form.nome.trim().length > 0
  const categoriaValida = !!form.categoria_id
  const origemValida = form.origem === 'acervo' || !!form.fornecedor_id
  const variacoesValidas =
    form.variacoes.length > 0 && form.variacoes.every(isVariacaoValida)
  const canSubmit =
    nomeValido && categoriaValida && origemValida && variacoesValidas && !isPending

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PageHeader
        title={mode === 'create' ? 'Novo item' : 'Editar item'}
        actions={
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {mode === 'create' ? 'Criar' : 'Salvar'}
            </Button>
          </div>
        }
      />

      {/* Bloco superior: item-pai */}
      <section className="rounded-lg border border-border-default bg-card p-5 space-y-5">
        <h2 className="text-sm font-medium text-text-secondary">Dados do item</h2>

        <div className="grid gap-5 md:grid-cols-[1fr,200px]">
          <div className="space-y-5">
            {/* Nome */}
            <div className="space-y-1.5">
              <Label htmlFor="item-nome">Nome *</Label>
              <Input
                id="item-nome"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex.: Tapete vermelho"
                required
                disabled={isPending}
              />
            </div>

            {/* Categoria — obrigatório */}
            <div className="space-y-1.5">
              <Label htmlFor="item-categoria">Categoria *</Label>
              <Select
                value={form.categoria_id ?? ''}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, categoria_id: v || null }))
                }
                disabled={isPending}
              >
                <SelectTrigger id="item-categoria">
                  <SelectValue placeholder="Selecione uma categoria">
                    {categorias.find((c) => c.id === form.categoria_id)?.nome}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categorias.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-text-tertiary">
                      Nenhuma categoria ativa cadastrada.
                    </div>
                  )}
                  {categorias.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Origem — toggle pills */}
            <div className="space-y-1.5">
              <Label>Origem *</Label>
              <div className="flex gap-2">
                {(['acervo', 'fornecedor'] as DecoracaoItemOrigem[]).map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setForm((f) => ({
                      ...f,
                      origem: o,
                      fornecedor_id: o === 'acervo' ? null : f.fornecedor_id,
                    }))}
                    disabled={isPending}
                    className={cn(
                      'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                      form.origem === o
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border-default bg-card text-text-secondary hover:bg-muted/40',
                    )}
                  >
                    {o === 'acervo' ? 'Acervo' : 'Fornecedor'}
                  </button>
                ))}
              </div>
            </div>

            {/* Fornecedor — visível apenas quando origem=fornecedor */}
            {form.origem === 'fornecedor' && (
              <div className="space-y-1.5">
                <Label htmlFor="item-fornecedor">Fornecedor *</Label>
                <Select
                  value={form.fornecedor_id ?? ''}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, fornecedor_id: v || null }))
                  }
                  disabled={isPending}
                >
                  <SelectTrigger id="item-fornecedor">
                    <SelectValue placeholder="Selecione um fornecedor">
                      {fornecedores.find((forn) => forn.id === form.fornecedor_id)?.nome}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {fornecedores.length === 0 && (
                      <div className="px-2 py-1.5 text-xs text-text-tertiary">
                        Nenhum fornecedor ativo cadastrado.
                      </div>
                    )}
                    {fornecedores.map((forn) => (
                      <SelectItem key={forn.id} value={forn.id}>
                        {forn.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Preços */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="item-preco-custo">Preço de custo (R$)</Label>
                <Input
                  id="item-preco-custo"
                  value={custoRaw}
                  onChange={(e) => setCustoRaw(e.target.value)}
                  onBlur={() => {
                    const n = parseMoney(custoRaw)
                    setCustoRaw(moneyDisplay(n))
                  }}
                  placeholder="0,00"
                  inputMode="decimal"
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-preco-venda">Preço de venda (R$)</Label>
                <Input
                  id="item-preco-venda"
                  value={vendaRaw}
                  onChange={(e) => setVendaRaw(e.target.value)}
                  onBlur={() => {
                    const n = parseMoney(vendaRaw)
                    setVendaRaw(moneyDisplay(n))
                  }}
                  placeholder="0,00"
                  inputMode="decimal"
                  disabled={isPending}
                />
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label htmlFor="item-obs">Observações</Label>
              <Textarea
                id="item-obs"
                value={form.observacoes ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, observacoes: e.target.value || null }))
                }
                placeholder="Notas internas sobre este item…"
                rows={3}
                disabled={isPending}
              />
            </div>

            {/* Ativo */}
            <div className="flex items-center justify-between rounded-lg border border-border-default p-3">
              <div>
                <p className="text-sm font-medium">Ativo</p>
                <p className="text-xs text-muted-foreground">
                  Itens inativos ficam ocultos por padrão.
                </p>
              </div>
              <Switch
                checked={form.ativo}
                onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))}
                disabled={isPending}
              />
            </div>
          </div>

          {/* Foto */}
          <div className="space-y-1.5">
            <Label>Foto</Label>
            {form.foto_path && signedUrls[form.foto_path] ? (
              <PhotoThumb
                src={signedUrls[form.foto_path]}
                alt={form.nome || 'foto do item'}
                onRemove={handleFotoRemove}
                disabled={isPending}
              />
            ) : (
              <PhotoDropZone
                bucket={BUCKET}
                folder={itemId ?? 'tmp'}
                maxFiles={1}
                existingCount={0}
                disabled={isPending}
                onUploadComplete={handleFotoUpload}
              />
            )}
            <p className="text-xs text-text-tertiary">
              A foto só é salva ao clicar em {mode === 'create' ? 'Criar' : 'Salvar'}.
            </p>
          </div>
        </div>
      </section>

      {/* Bloco variações */}
      <section className="rounded-lg border border-border-default bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-text-secondary">Variações</h2>
            <p className="text-xs text-text-tertiary">
              Cada variação tem um código único auto-gerado. Defina por Tamanho, Cor e/ou Detalhe.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addVariacao} disabled={isPending}>
            <Plus className="mr-1.5 h-4 w-4" />
            Adicionar variação
          </Button>
        </div>

        <div className="space-y-3">
          {form.variacoes.map((v, i) => (
            <VariacaoCard
              key={v.id ?? `new-${i}`}
              variacao={v}
              index={i}
              itemNome={form.nome}
              codigo={codigos[i] ?? null}
              disabled={isPending}
              bucket={BUCKET}
              folder={`${itemId ?? 'tmp'}/variacoes/${i}`}
              signedUrl={v.foto_path ? signedUrls[v.foto_path] : undefined}
              onChange={(next) => updateVariacao(i, next)}
              onRemove={() => removeVariacao(i)}
              onFotoUpload={(path) => handleVariacaoFotoUpload(i, path)}
              onFotoRemove={() => handleVariacaoFotoRemove(i)}
            />
          ))}
        </div>

        {!variacoesValidas && form.variacoes.length > 0 && (
          <p className="text-xs text-status-error-text">
            Cada variação precisa de ao menos um campo preenchido (Tamanho, Cor ou Detalhe).
          </p>
        )}
        {form.variacoes.length === 0 && (
          <p className="text-xs text-status-error-text">
            Cadastre ao menos uma variação.
          </p>
        )}
      </section>

      {/* Resumo de saldo em estoque — somente em edição, read-only */}
      {mode === 'edit' && estoquePorItem.length > 0 && (
        <section className="rounded-lg border border-border-default bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium text-text-secondary">Saldo em estoque</h2>
            </div>
            <a
              href={ROUTES.decoracaoEstoque}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Ajustar
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="space-y-1.5">
            {estoquePorItem.map((resumo) => {
              const variacao = detailQuery.data?.variacoes.find((v) => v.id === resumo.variacao_id)
              if (!variacao) return null
              const partes = [variacao.tamanho, variacao.cor, variacao.detalhe].filter(Boolean)
              const label = partes.length ? partes.join(' / ') : variacao.codigo

              const locaisComSaldo = resumo.locais.filter(
                (l) => (resumo.saldos[l.id] ?? 0) > 0,
              )

              return (
                <div
                  key={resumo.variacao_id}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm"
                >
                  <span className="font-medium">{label}</span>
                  <span className="font-mono text-xs text-muted-foreground">{variacao.codigo}</span>
                  <span className="text-muted-foreground">—</span>
                  {locaisComSaldo.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">sem estoque</span>
                  ) : (
                    <>
                      {locaisComSaldo.map((l, i) => (
                        <span key={l.id} className="text-sm">
                          {l.nome}: <strong>{resumo.saldos[l.id]}</strong>
                          {i < locaisComSaldo.length - 1 && ' ·'}
                        </span>
                      ))}
                      <span className="text-xs text-muted-foreground">
                        · total: <strong>{resumo.total}</strong>
                      </span>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Footer de ações de exclusão (apenas em edit) */}
      {mode === 'edit' && canDelete && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant={deleteConfirm ? 'destructive' : 'outline'}
            size="sm"
            disabled={isPending}
            onClick={handleDelete}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            {deleteConfirm ? 'Confirmar exclusão' : 'Excluir item'}
          </Button>
        </div>
      )}
    </form>
  )
}
