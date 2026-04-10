'use client'

import { useState } from 'react'
import { Building2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useUnitStore } from '@/stores/unit-store'

interface SelectUnitModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (unitId: string) => void
}

export function SelectUnitModal({ open, onClose, onConfirm }: SelectUnitModalProps) {
  const { userUnits, setActiveUnit } = useUnitStore()
  const [selectedId, setSelectedId] = useState<string>('')

  function handleConfirm() {
    if (!selectedId) return
    const found = userUnits.find((u) => u.unit_id === selectedId)
    const unit = found?.unit
      ? { id: found.unit.id, name: found.unit.name, slug: found.unit.slug }
      : null
    setActiveUnit(selectedId, unit)
    onConfirm(selectedId)
    setSelectedId('')
  }

  function handleClose() {
    setSelectedId('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-sm">
        <div className="flex flex-col items-center gap-4 pb-2">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
            <Building2 className="w-6 h-6 text-primary" />
          </div>

          <div className="text-center space-y-1">
            <DialogTitle className="text-base font-semibold">
              Selecione uma unidade
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Esta ação requer uma unidade específica. Selecione qual unidade deseja usar.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <Select
            value={selectedId || null}
            onValueChange={(v) => setSelectedId(v ?? '')}
          >
            <SelectTrigger>
              {selectedId
                ? <span data-slot="select-value" className="flex flex-1 text-left">
                    {userUnits.find((u) => u.unit_id === selectedId)?.unit?.name ?? 'Unidade'}
                  </span>
                : <SelectValue placeholder="Escolha uma unidade..." />}
            </SelectTrigger>
            <SelectContent>
              {userUnits.map((u) => (
                <SelectItem key={u.unit_id} value={u.unit_id}>
                  {u.unit?.name ?? u.unit_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              disabled={!selectedId}
              onClick={handleConfirm}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
