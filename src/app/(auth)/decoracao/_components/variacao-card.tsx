'use client'

import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Trash2, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { QrPrintModal } from './qr-print-modal'
import type { VariacaoFormInput } from '@/types/decoracao'

interface Props {
  variacao: VariacaoFormInput
  index: number
  itemNome: string
  /** Código real da variação (apenas quando já existe). Para variações novas, é null. */
  codigo: string | null
  disabled?: boolean
  onChange: (next: VariacaoFormInput) => void
  onRemove: () => void
}

function descricaoVariacao(v: VariacaoFormInput): string {
  const parts: string[] = []
  if (v.tamanho?.trim()) parts.push(v.tamanho.trim())
  if (v.cor?.trim()) parts.push(v.cor.trim())
  if (v.detalhe?.trim()) parts.push(v.detalhe.trim())
  return parts.join(' · ')
}

export function VariacaoCard({
  variacao,
  index,
  itemNome,
  codigo,
  disabled,
  onChange,
  onRemove,
}: Props) {
  const [printOpen, setPrintOpen] = useState(false)
  const [removeConfirm, setRemoveConfirm] = useState(false)

  function set<K extends keyof VariacaoFormInput>(key: K, value: VariacaoFormInput[K]) {
    onChange({ ...variacao, [key]: value })
  }

  function handleRemove() {
    if (!removeConfirm) {
      setRemoveConfirm(true)
      return
    }
    onRemove()
  }

  return (
    <div className="rounded-lg border border-border-default bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-text-secondary">Variação {index + 1}</h3>
        <div className="flex items-center gap-2">
          {codigo && (
            <span className="font-mono text-xs text-text-secondary">{codigo}</span>
          )}
          <Button
            type="button"
            variant={removeConfirm ? 'destructive' : 'ghost'}
            size="sm"
            onClick={handleRemove}
            disabled={disabled}
            title={removeConfirm ? 'Clique novamente para confirmar' : 'Remover variação'}
          >
            <Trash2 className="h-4 w-4" />
            <span className="ml-1 text-xs">{removeConfirm ? 'Confirmar' : 'Remover'}</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`var-${index}-tamanho`} className="text-xs">Tamanho</Label>
          <Input
            id={`var-${index}-tamanho`}
            value={variacao.tamanho ?? ''}
            onChange={(e) => set('tamanho', e.target.value || null)}
            placeholder="Ex.: 3m"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`var-${index}-cor`} className="text-xs">Cor</Label>
          <Input
            id={`var-${index}-cor`}
            value={variacao.cor ?? ''}
            onChange={(e) => set('cor', e.target.value || null)}
            placeholder="Ex.: Vermelho"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`var-${index}-detalhe`} className="text-xs">Detalhe</Label>
          <Input
            id={`var-${index}-detalhe`}
            value={variacao.detalhe ?? ''}
            onChange={(e) => set('detalhe', e.target.value || null)}
            placeholder="Outro descritor"
            disabled={disabled}
          />
        </div>
      </div>

      {/* QR + ações */}
      <div className="flex items-end justify-between gap-3 border-t border-border-default pt-3">
        <div className="flex items-center gap-3">
          <div className="rounded-md border border-border-default bg-white p-1.5">
            <QRCodeSVG
              value={codigo ?? `placeholder-${index}`}
              size={64}
              includeMargin={false}
              level="M"
              style={{ opacity: codigo ? 1 : 0.25 }}
            />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-text-tertiary">
              {codigo ? 'Código gerado' : 'Código será gerado ao salvar'}
            </p>
            {codigo && (
              <p className="font-mono text-sm font-medium text-text-primary">{codigo}</p>
            )}
          </div>
        </div>

        {codigo && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPrintOpen(true)}
            disabled={disabled}
          >
            <Printer className="mr-1.5 h-4 w-4" />
            Etiqueta
          </Button>
        )}
      </div>

      {codigo && (
        <QrPrintModal
          open={printOpen}
          onOpenChange={setPrintOpen}
          codigo={codigo}
          itemNome={itemNome || '(sem nome)'}
          variacaoDescricao={descricaoVariacao(variacao)}
        />
      )}

      <p className="text-xs text-text-tertiary">
        Preencha ao menos um dos campos acima.
      </p>
    </div>
  )
}
