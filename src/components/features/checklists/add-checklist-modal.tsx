'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useChecklistTemplates } from '@/hooks/use-checklists'
import type { TemplateWithItems } from '@/types/database.types'

interface AddChecklistModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (params: {
    templateId: string
    title: string
    assignedTo: string
    dueDate: string
  }) => void
  loading?: boolean
  users: Array<{ id: string; name: string }>
}

export function AddChecklistModal({
  open,
  onOpenChange,
  onConfirm,
  loading,
  users,
}: AddChecklistModalProps) {
  const { data: templates = [], isLoading } = useChecklistTemplates(true)

  const [search, setSearch]           = useState('')
  const [selectedTemplate, setSelected] = useState<TemplateWithItems | null>(null)
  const [title, setTitle]             = useState('')
  const [assignedTo, setAssignedTo]   = useState('')
  const [dueDate, setDueDate]         = useState('')

  const filtered = templates.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase())
  )

  function handleSelect(tpl: TemplateWithItems) {
    setSelected(tpl)
    setTitle(tpl.title)
  }

  function handleConfirm() {
    if (!selectedTemplate || !title.trim()) return
    onConfirm({
      templateId: selectedTemplate.id,
      title: title.trim(),
      assignedTo,
      dueDate,
    })
  }

  function handleClose() {
    setSearch('')
    setSelected(null)
    setTitle('')
    setAssignedTo('')
    setDueDate('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Checklist</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Busca de template */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              Selecionar Template
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar template..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>

            <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-border p-1">
              {isLoading && Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-9 rounded-lg" />
              ))}
              {!isLoading && filtered.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">
                  Nenhum template encontrado.
                </p>
              )}
              {filtered.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => handleSelect(tpl)}
                  className={cn(
                    'w-full text-left rounded-lg px-3 py-2 text-sm transition-colors',
                    selectedTemplate?.id === tpl.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted text-foreground'
                  )}
                >
                  <p className="font-medium">{tpl.title}</p>
                  <p className={cn(
                    'text-xs',
                    selectedTemplate?.id === tpl.id ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  )}>
                    {tpl.template_items.length} itens
                    {tpl.category && ` · ${tpl.category.name}`}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {selectedTemplate && (
            <>
              {/* Título do checklist */}
              <div className="space-y-1.5">
                <Label htmlFor="cl-title" className="text-sm">Nome do Checklist</Label>
                <Input
                  id="cl-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nome do checklist..."
                  className="h-9"
                />
              </div>

              {/* Responsável */}
              <div className="space-y-1.5">
                <Label htmlFor="cl-assigned" className="text-sm">Responsável</Label>
                <select
                  id="cl-assigned"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Sem responsável</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              {/* Data limite */}
              <div className="space-y-1.5">
                <Label htmlFor="cl-due" className="text-sm">Data Limite</Label>
                <Input
                  id="cl-due"
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={!selectedTemplate || !title.trim() || loading}
          >
            {loading ? 'Criando...' : 'Criar Checklist'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
