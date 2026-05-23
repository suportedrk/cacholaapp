'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, AlertTriangle, Trash2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { hasRole, DECORACAO_DELETE_ROLES } from '@/config/roles'
import { PhotoDropZone, PhotoThumb } from '@/components/shared/photo-upload'
import { useSignedUrls } from '@/hooks/use-signed-urls'
import { useCreateTema, useUpdateTema, useDeleteTema } from '@/hooks/use-decoracao'
import { createClient } from '@/lib/supabase/client'
import { DECORACAO_BUCKETS } from '@/lib/constants'
import { ForminhaColorDot } from './forminha-color-dot'
import type {
  DecoracaoForminhaCor,
  DecoracaoTemaComForminhas,
  TemaFormInput,
} from '@/types/decoracao'

const BUCKET = DECORACAO_BUCKETS.temas

interface TemaEditSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tema: DecoracaoTemaComForminhas | null
  createMode: boolean
  allForminhas: DecoracaoForminhaCor[]
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

function WarningBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-status-warning-border bg-status-warning-bg px-3 py-2 text-xs text-status-warning-text">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

export function TemaEditSheet({
  open,
  onOpenChange,
  tema,
  createMode,
  allForminhas,
}: TemaEditSheetProps) {
  const { profile } = useAuth()
  const canDelete = hasRole(profile?.role, DECORACAO_DELETE_ROLES)

  const createTema = useCreateTema()
  const updateTema = useUpdateTema()
  const deleteTema = useDeleteTema()
  const isPending = createTema.isPending || updateTema.isPending || deleteTema.isPending

  const [nome, setNome] = useState('')
  const [categoria, setCategoria] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [observacoes, setObservacoes] = useState('')
  const [personalizado, setPersonalizado] = useState(false)
  const [decoradoraExterna, setDecoradoraExterna] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)

  // Paths subidos durante esta edição e ainda não confirmados pelo Salvar.
  const pendingUploadsRef = useRef<string[]>([])

  const fotoPaths = fotoUrl ? [fotoUrl] : []
  const { data: signedUrls = {} } = useSignedUrls(BUCKET, fotoPaths)

  useEffect(() => {
    if (!open) return
    /* eslint-disable react-hooks/set-state-in-effect -- sincroniza props→form ao abrir */
    setConfirmingDelete(false)
    pendingUploadsRef.current = []
    if (createMode) {
      setNome('')
      setCategoria('')
      setAtivo(true)
      setObservacoes('')
      setPersonalizado(false)
      setDecoradoraExterna(false)
      setSelectedIds(new Set())
      setFotoUrl(null)
    } else if (tema) {
      setNome(tema.nome)
      setCategoria(tema.categoria ?? '')
      setAtivo(tema.ativo)
      setObservacoes(tema.observacoes ?? '')
      setPersonalizado(tema.personalizado)
      setDecoradoraExterna(tema.decoradora_externa)
      setSelectedIds(new Set(tema.forminhas.map((f) => f.id)))
      setFotoUrl(tema.foto_url)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, createMode, tema])

  function toggleForminha(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function buildInput(): TemaFormInput {
    return {
      nome: nome.trim(),
      categoria: categoria.trim() || null,
      ativo,
      observacoes: observacoes.trim() || null,
      personalizado,
      decoradora_externa: decoradoraExterna,
      forminha_cor_ids: [...selectedIds],
      foto_url: fotoUrl,
    }
  }

  function handleFotoUpload(storagePath: string): Promise<void> {
    setFotoUrl(storagePath)
    pendingUploadsRef.current = [...pendingUploadsRef.current, storagePath]
    return Promise.resolve()
  }

  function handleFotoRemove() {
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    const input = buildInput()
    const originalFotoUrl = tema?.foto_url ?? null

    function afterSuccess() {
      const orphans: string[] = []
      for (const p of pendingUploadsRef.current) {
        if (p !== fotoUrl) orphans.push(p)
      }
      if (originalFotoUrl && originalFotoUrl !== fotoUrl) orphans.push(originalFotoUrl)
      pendingUploadsRef.current = []
      void removeFromStorage(orphans)
      onOpenChange(false)
    }

    if (createMode) {
      createTema.mutate(input, { onSuccess: afterSuccess })
    } else if (tema) {
      updateTema.mutate({ id: tema.id, input }, { onSuccess: afterSuccess })
    }
  }

  function handleDelete() {
    if (!tema) return
    deleteTema.mutate(tema.id, {
      onSuccess: () => {
        const toClean: string[] = []
        if (tema.foto_url) toClean.push(tema.foto_url)
        pendingUploadsRef.current.forEach((p) => {
          if (p !== tema.foto_url) toClean.push(p)
        })
        pendingUploadsRef.current = []
        void removeFromStorage(toClean)
        onOpenChange(false)
      },
    })
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        showCloseButton
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b border-border-default px-6 py-4">
          <SheetTitle className="text-base font-semibold">
            {createMode ? 'Novo tema' : 'Editar tema'}
          </SheetTitle>
          <SheetDescription>
            Tema padrão da empresa — vale igual para todas as unidades.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {/* Avisos */}
            {personalizado && (
              <WarningBanner message="Tema personalizado — consultar a Mari sobre as cores." />
            )}
            {decoradoraExterna && (
              <WarningBanner message="Decoração de decoradora externa — confirmar as cores com ela." />
            )}

            {/* Nome */}
            <div className="space-y-1.5">
              <Label htmlFor="tema-nome">Nome</Label>
              <Input
                id="tema-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Safari"
                autoFocus
              />
            </div>

            {/* Categoria */}
            <div className="space-y-1.5">
              <Label htmlFor="tema-categoria">Categoria</Label>
              <Input
                id="tema-categoria"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="Opcional — ex: Personagens, Animais…"
              />
            </div>

            {/* Foto */}
            <div className="space-y-1.5">
              <Label>Foto</Label>
              {fotoUrl && signedUrls[fotoUrl] ? (
                <PhotoThumb
                  src={signedUrls[fotoUrl]}
                  alt={nome || 'foto do tema'}
                  onRemove={handleFotoRemove}
                  disabled={isPending}
                />
              ) : (
                <PhotoDropZone
                  bucket={BUCKET}
                  folder={tema?.id ?? 'tmp'}
                  maxFiles={1}
                  existingCount={0}
                  disabled={isPending}
                  onUploadComplete={handleFotoUpload}
                />
              )}
              <p className="text-xs text-text-tertiary">
                As mudanças na foto só são salvas ao clicar em Salvar.
              </p>
            </div>

            {/* Cores de forminha */}
            <div className="space-y-1.5">
              <Label>Cores de forminha</Label>
              <p className="text-xs text-text-tertiary">
                {selectedIds.size} de {allForminhas.length} selecionadas.
              </p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {allForminhas.map((f) => {
                  const selected = selectedIds.has(f.id)
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => toggleForminha(f.id)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-xs transition-colors',
                        selected
                          ? 'border-[var(--primary)] bg-brand-50 text-text-primary'
                          : 'border-border-default text-text-secondary hover:bg-surface-secondary',
                        !f.ativo && 'opacity-60',
                      )}
                      aria-pressed={selected}
                    >
                      <ForminhaColorDot
                        corHex={f.cor_hex}
                        numero={f.numero}
                        nome={f.nome}
                        size="sm"
                      />
                      <span className="truncate">
                        <span className="font-mono">{f.numero}</span> · {f.nome}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label htmlFor="tema-observacoes">Observações</Label>
              <Textarea
                id="tema-observacoes"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
                placeholder="Notas internas sobre o tema…"
              />
            </div>

            {/* Marcadores */}
            <div className="space-y-3 rounded-lg border border-border-default p-3">
              <div className="flex items-center gap-3">
                <Switch id="tema-ativo" checked={ativo} onCheckedChange={setAtivo} />
                <Label htmlFor="tema-ativo" className="cursor-pointer font-medium">
                  Tema ativo
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="tema-personalizado"
                  checked={personalizado}
                  onCheckedChange={setPersonalizado}
                />
                <Label htmlFor="tema-personalizado" className="cursor-pointer font-medium">
                  Tema personalizado
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="tema-externa"
                  checked={decoradoraExterna}
                  onCheckedChange={setDecoradoraExterna}
                />
                <Label htmlFor="tema-externa" className="cursor-pointer font-medium">
                  Decoradora externa
                </Label>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-border-default px-6 py-4">
            <div>
              {!createMode && canDelete && (
                confirmingDelete ? (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                      disabled={isPending}
                    >
                      {deleteTema.isPending && (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      )}
                      Confirmar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmingDelete(false)}
                      disabled={isPending}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmingDelete(true)}
                    disabled={isPending}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Excluir
                  </Button>
                )
              )}
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending || !nome.trim()}>
                {(createTema.isPending || updateTema.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Salvar
              </Button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
