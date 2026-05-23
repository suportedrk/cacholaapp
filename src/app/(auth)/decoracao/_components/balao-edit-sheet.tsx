'use client'

import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { PhotoDropZone, PhotoThumb } from '@/components/shared/photo-upload'
import { useSignedUrls } from '@/hooks/use-signed-urls'
import { useCreateBalaoModelo, useUpdateBalaoModelo, useDeleteBalaoModelo } from '@/hooks/use-decoracao'
import { hasRole } from '@/config/roles'
import { DECORACAO_DELETE_ROLES } from '@/config/roles'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { DECORACAO_BUCKETS } from '@/lib/constants'
import type { DecoracaoBalaoModelo, BalaoModeloFormInput } from '@/types/decoracao'

const BUCKET = DECORACAO_BUCKETS.baloes

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  modelo: DecoracaoBalaoModelo | null
  createMode: boolean
}

const EMPTY: BalaoModeloFormInput = {
  nome: '',
  categoria: null,
  custo: null,
  valor_venda: null,
  ativo: true,
  observacoes: null,
}

/**
 * Converte uma string em formato brasileiro (ponto = milhar, vírgula = decimal)
 * para number. "1.000,00" → 1000, "3.200" → 3200, "80" → 80, "" → null.
 * Se já vier number, devolve como está (defensivo).
 */
function parseMoney(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 ? raw : null

  const cleaned = raw.replace(/[^0-9,.\-]/g, '')
  if (!cleaned) return null

  // BR: remove TODOS os pontos (separador de milhar), troca vírgula por ponto (decimal)
  const normalized = cleaned.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(normalized)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function moneyDisplay(v: number | null): string {
  if (v === null) return ''
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function removeFromStorage(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  try {
    const supabase = createClient()
    await supabase.storage.from(BUCKET).remove(paths)
  } catch {
    // fire-and-forget — arquivo órfão fica no storage mas não bloqueia o usuário
  }
}

export function BalaoEditSheet({ open, onOpenChange, modelo, createMode }: Props) {
  const { profile } = useAuth()
  const canDelete = hasRole(profile?.role, DECORACAO_DELETE_ROLES)

  const createMutation = useCreateBalaoModelo()
  const updateMutation = useUpdateBalaoModelo()
  const deleteMutation = useDeleteBalaoModelo()

  const [form, setForm] = useState<BalaoModeloFormInput>(EMPTY)
  const [custoRaw, setCustoRaw] = useState('')
  const [vendaRaw, setVendaRaw] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)

  // Paths subidos ao storage durante esta edição e ainda não confirmados pelo Salvar.
  // Ref (não state) porque precisamos ler/escrever sincronamente em handlers de fechamento.
  const pendingUploadsRef = useRef<string[]>([])

  const fotoPaths = fotoUrl ? [fotoUrl] : []
  const { data: signedUrls = {} } = useSignedUrls(BUCKET, fotoPaths)

  useEffect(() => {
    if (!open) return
    /* eslint-disable react-hooks/set-state-in-effect -- sincroniza props→form ao abrir */
    setDeleteConfirm(false)
    pendingUploadsRef.current = []
    if (createMode) {
      setForm(EMPTY)
      setCustoRaw('')
      setVendaRaw('')
      setFotoUrl(null)
    } else if (modelo) {
      setForm({
        nome: modelo.nome,
        categoria: modelo.categoria,
        custo: modelo.custo,
        valor_venda: modelo.valor_venda,
        ativo: modelo.ativo,
        observacoes: modelo.observacoes,
      })
      setCustoRaw(moneyDisplay(modelo.custo))
      setVendaRaw(moneyDisplay(modelo.valor_venda))
      setFotoUrl(modelo.foto_url)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, createMode, modelo?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  function handleFotoUpload(storagePath: string): Promise<void> {
    setFotoUrl(storagePath)
    pendingUploadsRef.current = [...pendingUploadsRef.current, storagePath]
    return Promise.resolve()
  }

  function handleFotoRemove() {
    // Apenas marca como vazio no form — a remoção real só acontece no Salvar.
    setFotoUrl(null)
  }

  function discardPendingUploads() {
    const toClean = pendingUploadsRef.current
    pendingUploadsRef.current = []
    if (toClean.length > 0) void removeFromStorage(toClean)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      onOpenChange(true)
      return
    }
    discardPendingUploads()
    onOpenChange(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: BalaoModeloFormInput = {
      ...form,
      custo: parseMoney(custoRaw),
      valor_venda: parseMoney(vendaRaw),
      foto_url: fotoUrl,
    }
    try {
      if (createMode) {
        await createMutation.mutateAsync(payload)
      } else {
        await updateMutation.mutateAsync({ id: modelo!.id, input: payload })
      }
    } catch {
      // toast disparado pela mutation — não fecha o sheet
      return
    }

    // Sucesso: deletar arquivos órfãos.
    const originalFotoUrl = modelo?.foto_url ?? null
    const orphans: string[] = []
    for (const p of pendingUploadsRef.current) {
      if (p !== fotoUrl) orphans.push(p)
    }
    if (originalFotoUrl && originalFotoUrl !== fotoUrl) orphans.push(originalFotoUrl)
    pendingUploadsRef.current = [] // limpa ANTES de close para handleOpenChange não re-disparar cleanup
    void removeFromStorage(orphans)

    onOpenChange(false)
  }

  async function handleDelete() {
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      return
    }
    await deleteMutation.mutateAsync(modelo!.id)
    // Após delete, o registro já não existe — limpa qualquer foto staged/original do storage.
    const toClean: string[] = []
    if (modelo?.foto_url) toClean.push(modelo.foto_url)
    pendingUploadsRef.current.forEach((p) => {
      if (p !== modelo?.foto_url) toClean.push(p)
    })
    pendingUploadsRef.current = []
    void removeFromStorage(toClean)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{createMode ? 'Novo modelo de balão' : 'Editar modelo'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5 px-1">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="balao-nome">Nome *</Label>
            <Input
              id="balao-nome"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex.: Meio arco + complemento"
              required
            />
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <Label htmlFor="balao-categoria">Categoria</Label>
            <Input
              id="balao-categoria"
              value={form.categoria ?? ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, categoria: e.target.value || null }))
              }
              placeholder="Opcional"
            />
          </div>

          {/* Custo e Valor de venda */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="balao-custo">Custo (R$)</Label>
              <Input
                id="balao-custo"
                value={custoRaw}
                onChange={(e) => setCustoRaw(e.target.value)}
                onBlur={() => {
                  const n = parseMoney(custoRaw)
                  setCustoRaw(n !== null ? moneyDisplay(n) : '')
                }}
                placeholder="0,00"
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="balao-venda">Valor de venda (R$)</Label>
              <Input
                id="balao-venda"
                value={vendaRaw}
                onChange={(e) => setVendaRaw(e.target.value)}
                onBlur={() => {
                  const n = parseMoney(vendaRaw)
                  setVendaRaw(n !== null ? moneyDisplay(n) : '')
                }}
                placeholder="0,00"
                inputMode="decimal"
              />
            </div>
          </div>

          {/* Foto */}
          <div className="space-y-1.5">
            <Label>Foto</Label>
            {fotoUrl && signedUrls[fotoUrl] ? (
              <PhotoThumb
                src={signedUrls[fotoUrl]}
                alt={form.nome || 'foto do modelo'}
                onRemove={handleFotoRemove}
                disabled={isPending}
              />
            ) : (
              <PhotoDropZone
                bucket={BUCKET}
                folder={modelo?.id ?? 'tmp'}
                maxFiles={1}
                existingCount={0}
                disabled={isPending}
                onUploadComplete={handleFotoUpload}
              />
            )}
            <p className="text-xs text-text-tertiary">
              As mudanças na foto só são salvas ao clicar em {createMode ? 'Criar' : 'Salvar'}.
            </p>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label htmlFor="balao-obs">Observações</Label>
            <Textarea
              id="balao-obs"
              value={form.observacoes ?? ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, observacoes: e.target.value || null }))
              }
              rows={3}
              placeholder="Notas internas sobre este modelo..."
            />
          </div>

          {/* Ativo */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Ativo</p>
              <p className="text-xs text-muted-foreground">
                Modelos inativos ficam ocultos por padrão na lista.
              </p>
            </div>
            <Switch
              checked={form.ativo}
              onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))}
            />
          </div>

          <SheetFooter className="flex-col gap-2 pt-2 sm:flex-row sm:justify-between">
            {/* Excluir */}
            {!createMode && canDelete && (
              <Button
                type="button"
                variant={deleteConfirm ? 'destructive' : 'outline'}
                size="sm"
                disabled={isPending}
                onClick={handleDelete}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                {deleteConfirm ? 'Confirmar exclusão' : 'Excluir'}
              </Button>
            )}
            <div className="flex gap-2 sm:ml-auto">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending || !form.nome.trim()}>
                {isPending ? 'Salvando…' : createMode ? 'Criar' : 'Salvar'}
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
