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
import {
  useLogRecompraContact,
  type RecompraOutcome,
  type RecompraType,
} from '@/hooks/use-recompra'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

interface RecompraContactDialogProps {
  opportunity: {
    contact_email:           string
    contact_name:            string
    aniversariante_birthday: string
    is_carteira_livre:       boolean
  } | null
  recompraType: RecompraType
  onClose:      () => void
}

const OUTCOME_OPTIONS: { value: RecompraOutcome; label: string }[] = [
  { value: 'tentou',  label: 'Tentativa (sem resposta)' },
  { value: 'recusou', label: 'Recusou' },
  { value: 'vendeu',  label: 'Vendeu — nova festa agendada!' },
  { value: 'outro',   label: 'Outro' },
]

export function RecompraContactDialog({
  opportunity,
  recompraType,
  onClose,
}: RecompraContactDialogProps) {
  const { profile }  = useAuth()
  const logContact   = useLogRecompraContact()

  const [outcome, setOutcome] = useState<RecompraOutcome | ''>('')
  const [notes,   setNotes]   = useState('')

  const sellerId = profile?.seller_id as string | null

  function handleSave() {
    if (!opportunity || !outcome || !sellerId || !profile?.id) return

    logContact.mutate(
      {
        contact_email:                opportunity.contact_email,
        aniversariante_birthday:      opportunity.aniversariante_birthday,
        recompra_type:                recompraType,
        seller_id:                    sellerId,
        contacted_by:                 profile.id,
        outcome:                      outcome as RecompraOutcome,
        notes:                        notes.trim() || null,
        captured_from_carteira_livre: opportunity.is_carteira_livre,
      },
      {
        onSuccess: () => {
          toast.success(
            opportunity.is_carteira_livre
              ? 'Contato registrado! Oportunidade capturada da Carteira Livre.'
              : 'Contato de recompra registrado.',
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
          <DialogTitle>Registrar contato de recompra</DialogTitle>
          {opportunity && (
            <p className="text-sm text-muted-foreground pt-1">
              {opportunity.contact_name}
              {recompraType === 'aniversario' && (
                <span className="text-muted-foreground/70">
                  {' '}— aniversário em{' '}
                  {new Date(opportunity.aniversariante_birthday + 'T00:00:00').toLocaleDateString('pt-BR', {
                    day: '2-digit', month: '2-digit',
                  })}
                </span>
              )}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Resultado do contato</Label>
            <Select value={outcome} onValueChange={(v) => setOutcome(v as RecompraOutcome)}>
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
              placeholder="Interesse do cliente, agendamento…"
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
