'use client'

import { useEffect, useState } from 'react'
import { Loader2, ImageOff } from 'lucide-react'
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
import { useCreateForminhaCor, useUpdateForminhaCor } from '@/hooks/use-decoracao'
import type { DecoracaoForminhaCor } from '@/types/decoracao'

interface ForminhaEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cor: DecoracaoForminhaCor | null
  createMode: boolean
  freeNumbers: number[]
}

const DEFAULT_PICKER = '#7c8d78'

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

  useEffect(() => {
    if (!open) return
    /* eslint-disable react-hooks/set-state-in-effect -- sincroniza props→form ao abrir */
    if (createMode) {
      setNumero(freeNumbers[0] ?? null)
      setNome('')
      setCorHex(null)
      setAtivo(true)
    } else if (cor) {
      setNumero(cor.numero)
      setNome(cor.nome)
      setCorHex(cor.cor_hex)
      setAtivo(cor.ativo)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, createMode, cor, freeNumbers])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = nome.trim()
    if (!trimmed) return

    if (createMode) {
      if (numero == null) return
      createForminha.mutate(
        { numero, nome: trimmed, cor_hex: corHex, ativo },
        { onSuccess: () => onOpenChange(false) },
      )
    } else if (cor) {
      updateForminha.mutate(
        { id: cor.id, input: { nome: trimmed, cor_hex: corHex, ativo } },
        { onSuccess: () => onOpenChange(false) },
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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

          {/* Foto — upload deferido para micro-passo separado */}
          <div className="space-y-1.5">
            <Label>Foto</Label>
            <div className="flex items-center gap-2 rounded-md border border-dashed border-border-default px-3 py-2.5 text-xs text-text-tertiary">
              <ImageOff className="h-4 w-4" />
              Upload de foto — em breve
            </div>
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
              onClick={() => onOpenChange(false)}
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
