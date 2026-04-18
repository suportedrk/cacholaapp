'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useLogUpsellContact, type UpsellOutcome, type UpsellOpportunity } from '@/hooks/use-upsell'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

interface ContactDialogProps {
  opportunity: UpsellOpportunity | null
  onClose:     () => void
}

const OUTCOME_OPTIONS: { value: UpsellOutcome; label: string }[] = [
  { value: 'tentou',           label: 'Tentativa (sem resposta)' },
  { value: 'recusou',          label: 'Recusou' },
  { value: 'vendeu_adicional', label: 'Vendeu adicional' },
  { value: 'vendeu_upgrade',   label: 'Vendeu upgrade' },
  { value: 'outro',            label: 'Outro' },
]

export function ContactDialog({ opportunity, onClose }: ContactDialogProps) {
  const { profile } = useAuth()
  const logContact  = useLogUpsellContact()

  const [outcome, setOutcome] = useState<UpsellOutcome | ''>('')
  const [notes,   setNotes]   = useState('')

  const sellerId = profile?.seller_id as string | null

  function handleSave() {
    if (!opportunity || !outcome || !sellerId || !profile?.id) return

    logContact.mutate(
      {
        event_id:                    opportunity.event_id,
        seller_id:                   sellerId,
        contacted_by:                profile.id,
        outcome:                     outcome as UpsellOutcome,
        notes:                       notes.trim() || null,
        captured_from_carteira_livre: opportunity.is_carteira_livre,
      },
      {
        onSuccess: () => {
          toast.success(
            opportunity.is_carteira_livre
              ? 'Contato registrado! Oportunidade capturada da Carteira Livre.'
              : 'Contato registrado com sucesso.',
          )
          setOutcome('')
          setNotes('')
          onClose()
        },
        onError: (err) => {
          toast.error('Erro ao registrar: ' + (err as Error).message)
        },
      },
    )
  }

  function handleClose() {
    setOutcome('')
    setNotes('')
    onClose()
  }

  return (
    <Dialog open={!!opportunity} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar contato</DialogTitle>
          {opportunity && (
            <p className="text-sm text-muted-foreground pt-1">
              {opportunity.contact_name} — {opportunity.event_title}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Resultado do contato</Label>
            <Select value={outcome} onValueChange={(v) => setOutcome(v as UpsellOutcome)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar resultado…" />
              </SelectTrigger>
              <SelectContent>
                {OUTCOME_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>
              Observações <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes do contato, interesse do cliente…"
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={logContact.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!outcome || !sellerId || logContact.isPending}
          >
            {logContact.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
