'use client'

import { useState, useEffect } from 'react'
import { Shield } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCreatePreReserva, useUpdatePreReserva } from '@/hooks/use-pre-reserva-mutations'
import type { CalendarPreReserva } from '@/types/pre-reservas'

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

interface PreReservaModalProps {
  open:       boolean
  onClose:    () => void
  unitId:     string          // sempre definido ao abrir (guard no pai)
  editItem?:  CalendarPreReserva | null
  /** Data pré-selecionada ao criar (ex: clique num dia do calendário) */
  defaultDate?: string
}

// ─────────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────────

export function PreReservaModal({
  open,
  onClose,
  unitId,
  editItem,
  defaultDate,
}: PreReservaModalProps) {
  const isEdit = !!editItem

  const [date,          setDate]          = useState('')
  const [time,          setTime]          = useState('')
  const [clientName,    setClientName]    = useState('')
  const [clientContact, setClientContact] = useState('')
  const [description,   setDescription]  = useState('')
  const [errors,        setErrors]        = useState<{ date?: string; clientName?: string }>({})

  const createMutation = useCreatePreReserva()
  const updateMutation = useUpdatePreReserva()
  const isPending = createMutation.isPending || updateMutation.isPending

  // Preencher campos no modo edição / limpar no modo criar
  useEffect(() => {
    if (open) {
      if (editItem) {
        setDate(editItem.date)
        setTime(editItem.time ?? '')
        setClientName(editItem.title)
        setClientContact(editItem.client_contact ?? '')
        setDescription(editItem.description ?? '')
      } else {
        setDate(defaultDate ?? '')
        setTime('')
        setClientName('')
        setClientContact('')
        setDescription('')
      }
      setErrors({})
    }
  }, [open, editItem, defaultDate])

  function validate() {
    const next: typeof errors = {}
    if (!date)       next.date       = 'Data é obrigatória'
    if (!clientName.trim()) next.clientName = 'Nome do cliente é obrigatório'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return

    const payload = {
      unit_id:        unitId,
      date,
      time:           time || null,
      client_name:    clientName.trim(),
      client_contact: clientContact.trim() || null,
      description:    description.trim()   || null,
    }

    try {
      if (isEdit && editItem) {
        await updateMutation.mutateAsync({ id: editItem.id, ...payload })
      } else {
        await createMutation.mutateAsync(payload)
      }
      onClose()
    } catch {
      // toast já disparado dentro do hook
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10">
              <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <DialogTitle>
              {isEdit ? 'Editar Pré-venda' : 'Nova Pré-venda Diretoria'}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Data + Horário */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pr-date">
                Data <span className="text-destructive">*</span>
              </Label>
              <Input
                id="pr-date"
                type="date"
                value={date}
                onChange={(e) => { setDate(e.target.value); setErrors((p) => ({ ...p, date: undefined })) }}
                className={errors.date ? 'border-destructive' : ''}
              />
              {errors.date && (
                <p className="text-xs text-destructive">{errors.date}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pr-time">Horário</Label>
              <Input
                id="pr-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          {/* Nome do cliente */}
          <div className="space-y-1.5">
            <Label htmlFor="pr-client">
              Nome do cliente <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pr-client"
              placeholder="Nome do responsável pela pré-reserva"
              value={clientName}
              onChange={(e) => { setClientName(e.target.value); setErrors((p) => ({ ...p, clientName: undefined })) }}
              className={errors.clientName ? 'border-destructive' : ''}
            />
            {errors.clientName && (
              <p className="text-xs text-destructive">{errors.clientName}</p>
            )}
          </div>

          {/* Contato */}
          <div className="space-y-1.5">
            <Label htmlFor="pr-contact">Contato do cliente</Label>
            <Input
              id="pr-contact"
              placeholder="Telefone ou e-mail"
              value={clientContact}
              onChange={(e) => setClientContact(e.target.value)}
            />
          </div>

          {/* Observação */}
          <div className="space-y-1.5">
            <Label htmlFor="pr-desc">Observação</Label>
            <Textarea
              id="pr-desc"
              placeholder="Detalhes adicionais sobre esta pré-reserva..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending
              ? isEdit ? 'Salvando…' : 'Criando…'
              : isEdit ? 'Salvar' : 'Criar Pré-reserva'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
