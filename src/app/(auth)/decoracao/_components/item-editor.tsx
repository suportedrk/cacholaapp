'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Plus, AlertCircle, Loader2, Trash2 } from 'lucide-react'
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
import {
  useDecoracaoItem,
  useCreateItem,
  useUpdateItem,
  useDeleteItem,
} from '@/hooks/use-decoracao-itens'
import { hasRole, DECORACAO_DELETE_ROLES } from '@/config/roles'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { DECORACAO_BUCKETS, ROUTES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { VariacaoCard } from './variacao-card'
import type {
  DecoracaoItemTipo,
  ItemFormInput,
  VariacaoFormInput,
} from '@/types/decoracao'

const BUCKET = DECORACAO_BUCKETS.itens

interface Props {
  mode: 'create' | 'edit'
  itemId?: string
}

function newEmptyVariacao(ordem: number): VariacaoFormInput {
  return { tamanho: null, cor: null, detalhe: null, ordem }
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

  const [form, setForm] = useState<ItemFormInput>({
    nome: '',
    tipo: 'proprio',
    fornecedor_id: null,
    foto_path: null,
    observacoes: null,
    ativo: true,
    variacoes: [newEmptyVariacao(0)],
  })
  /** Mapa de codigos reais por índice da variação (para edição). Variações novas não têm. */
  const [codigos, setCodigos] = useState<Record<number, string>>({})
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const pendingUploadsRef = useRef<string[]>([])
  const fotoPaths = form.foto_path ? [form.foto_path] : []
  const { data: signedUrls = {} } = useSignedUrls(BUCKET, fotoPaths)

  // Hidrata form em edit
  useEffect(() => {
    if (mode !== 'edit') return
    if (!detailQuery.data) return
    /* eslint-disable react-hooks/set-state-in-effect -- sincroniza props→form */
    const d = detailQuery.data
    setForm({
      nome: d.nome,
      tipo: d.tipo,
      fornecedor_id: d.fornecedor_id,
      foto_path: d.foto_path,
      observacoes: d.observacoes,
      ativo: d.ativo,
      variacoes: d.variacoes.map((v) => ({
        id: v.id,
        tamanho: v.tamanho,
        cor: v.cor,
        detalhe: v.detalhe,
        ordem: v.ordem,
      })),
    })
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
    if (form.variacoes.length === 0) return
    if (!form.variacoes.every(isVariacaoValida)) return

    const payload: ItemFormInput = {
      nome,
      tipo: form.tipo,
      fornecedor_id: form.tipo === 'alugado' ? form.fornecedor_id : null,
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

      // Sucesso: limpa órfãos
      const originalFotoPath = detailQuery.data?.foto_path ?? null
      const orphans: string[] = []
      for (const p of pendingUploadsRef.current) {
        if (p !== form.foto_path) orphans.push(p)
      }
      if (originalFotoPath && originalFotoPath !== form.foto_path) orphans.push(originalFotoPath)
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
  const variacoesValidas =
    form.variacoes.length > 0 && form.variacoes.every(isVariacaoValida)
  const canSubmit = nomeValido && variacoesValidas && !isPending

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

            {/* Tipo — toggle pills */}
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <div className="flex gap-2">
                {(['proprio', 'alugado'] as DecoracaoItemTipo[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({
                      ...f,
                      tipo: t,
                      fornecedor_id: t === 'proprio' ? null : f.fornecedor_id,
                    }))}
                    disabled={isPending}
                    className={cn(
                      'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                      form.tipo === t
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border-default bg-card text-text-secondary hover:bg-muted/40',
                    )}
                  >
                    {t === 'proprio' ? 'Próprio' : 'Alugado'}
                  </button>
                ))}
              </div>
            </div>

            {/* Fornecedor — visível apenas quando alugado */}
            {form.tipo === 'alugado' && (
              <div className="space-y-1.5">
                <Label htmlFor="item-fornecedor">Fornecedor</Label>
                <Select
                  value={form.fornecedor_id ?? ''}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, fornecedor_id: v || null }))
                  }
                  disabled={isPending}
                >
                  <SelectTrigger id="item-fornecedor">
                    <SelectValue placeholder="Selecione um fornecedor (opcional)" />
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
              onChange={(next) => updateVariacao(i, next)}
              onRemove={() => removeVariacao(i)}
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
