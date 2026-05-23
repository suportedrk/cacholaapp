'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PhotoDropZone, PhotoThumb } from '@/components/shared/photo-upload'
import { useSignedUrls } from '@/hooks/use-signed-urls'
import { useCreateForminhaCor, useUpdateForminhaCor } from '@/hooks/use-decoracao'
import { createClient } from '@/lib/supabase/client'
import { DECORACAO_BUCKETS } from '@/lib/constants'
import type { DecoracaoForminhaCor } from '@/types/decoracao'

const BUCKET = DECORACAO_BUCKETS.forminhas

interface ForminhaEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cor: DecoracaoForminhaCor | null
  createMode: boolean
  freeNumbers: number[]
}

const DEFAULT_PICKER = '#7c8d78'

async function removeFromStorage(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  try {
    const supabase = createClient()
    await supabase.storage.from(BUCKET).remove(paths)
  } catch {
    // fire-and-forget
  }
}

export function ForminhaEditDialog({
  open,
  onOpenChange,
  cor,
  createMode,
  freeNumbers,
}: ForminhaEditDialogProps) {
  const createForminha = useCreateForminhaCor()
  const updateForminha = useUpdateForminhaCor()
  const isPending = createForminha.isPending || updateForminha.isPending

  const [numero, setNumero] = useState<number | null>(null)
  const [nome, setNome] = useState('')
  const [corHex, setCorHex] = useState<string | null>(null)
  const [ativo, setAtivo] = useState(true)
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)

  // Paths subidos durante esta edição e ainda não confirmados pelo Salvar.
  const pendingUploadsRef = useRef<string[]>([])

  const fotoPaths = fotoUrl ? [fotoUrl] : []
  const { data: signedUrls = {} } = useSignedUrls(BUCKET, fotoPaths)

  useEffect(() => {
    if (!open) return
    /* eslint-disable react-hooks/set-state-in-effect -- sincroniza props→form ao abrir */
    pendingUploadsRef.current = []
    if (createMode) {
      setNumero(freeNumbers[0] ?? null)
      setNome('')
      setCorHex(null)
      setAtivo(true)
      setFotoUrl(null)
    } else if (cor) {
      setNumero(cor.numero)
      setNome(cor.nome)
      setCorHex(cor.cor_hex)
      setAtivo(cor.ativo)
      setFotoUrl(cor.foto_url)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, createMode, cor, freeNumbers])

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
    const trimmed = nome.trim()
    if (!trimmed) return

    const originalFotoUrl = cor?.foto_url ?? null

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
      if (numero == null) return
      createForminha.mutate(
        // Forminhas não permitem foto no createMode (precisam do id para gravar no storage),
        // então foto_url sempre é null aqui — mas mantemos a estrutura para consistência.
        { numero, nome: trimmed, cor_hex: corHex, ativo, foto_url: fotoUrl },
        { onSuccess: afterSuccess },
      )
    } else if (cor) {
      updateForminha.mutate(
        { id: cor.id, input: { nome: trimmed, cor_hex: corHex, ativo, foto_url: fotoUrl } },
        { onSuccess: afterSuccess },
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {createMode ? 'Nova cor de forminha' : `Editar forminha Nº ${cor?.numero ?? ''}`}
          </DialogTitle>
          <DialogDescription>
            Defina o nome e a cor. A cor alimenta as bolinhas exibidas nos temas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {createMode && (
            <div className="space-y-1.5">
              <Label htmlFor="forminha-numero">Número</Label>
              <Select
                value={numero != null ? String(numero) : ''}
                onValueChange={(v) => setNumero(Number(v))}
              >
                <SelectTrigger id="forminha-numero" className="w-full">
                  <SelectValue>
                    {numero != null ? `Nº ${numero}` : 'Selecione o número'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {freeNumbers.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      Nº {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="forminha-nome">Nome</Label>
            <Input
              id="forminha-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Rosa bebê"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="forminha-cor">Cor</Label>
            <div className="flex items-center gap-3">
              <input
                id="forminha-cor"
                type="color"
                value={corHex ?? DEFAULT_PICKER}
                onChange={(e) => setCorHex(e.target.value)}
                className="h-9 w-14 shrink-0 cursor-pointer rounded-md border border-border-default bg-transparent p-1"
                aria-label="Seletor de cor"
              />
              <span className="font-mono text-sm text-text-secondary">
                {corHex ?? 'Sem cor definida'}
              </span>
              {corHex && (
                <button
                  type="button"
                  onClick={() => setCorHex(null)}
                  className="ml-auto text-xs text-text-link hover:underline"
                >
                  Limpar cor
                </button>
              )}
            </div>
            <p className="text-xs text-text-tertiary">
              Sem cor definida, a forminha aparece tracejada na legenda.
            </p>
          </div>

          {/* Foto */}
          <div className="space-y-1.5">
            <Label>Foto</Label>
            {fotoUrl && signedUrls[fotoUrl] ? (
              <PhotoThumb
                src={signedUrls[fotoUrl]}
                alt={nome || 'foto da forminha'}
                onRemove={handleFotoRemove}
                disabled={isPending}
              />
            ) : !createMode ? (
              <PhotoDropZone
                bucket={BUCKET}
                folder={cor?.id ?? 'tmp'}
                maxFiles={1}
                existingCount={0}
                disabled={isPending}
                onUploadComplete={handleFotoUpload}
              />
            ) : (
              <p className="text-xs text-text-tertiary py-1">
                Salve a cor primeiro para adicionar uma foto.
              </p>
            )}
            {!createMode && (
              <p className="text-xs text-text-tertiary">
                As mudanças na foto só são salvas ao clicar em Salvar.
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-border-default p-3">
            <Switch id="forminha-ativo" checked={ativo} onCheckedChange={setAtivo} />
            <Label htmlFor="forminha-ativo" className="cursor-pointer font-medium">
              Cor ativa
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !nome.trim()}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
