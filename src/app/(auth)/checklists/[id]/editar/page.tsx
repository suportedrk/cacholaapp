'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/shared/page-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useChecklist,
  useUpdateChecklist,
} from '@/hooks/use-checklists'
import { useUsers } from '@/hooks/use-users'
import { PRIORITY_LABELS } from '@/types/database.types'
import type { Priority, User } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// PRIORITY ORDER
// ─────────────────────────────────────────────────────────────
const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low']

// ─────────────────────────────────────────────────────────────
// LOADING SKELETON
// ─────────────────────────────────────────────────────────────
function EditarChecklistSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="space-y-4 max-w-2xl">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────
export default function EditarChecklistPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { data: checklist, isLoading, isError } = useChecklist(id)
  const users = (useUsers({ isActive: true }).data ?? []) as User[]

  const { mutate: updateChecklist, isPending: isSaving } = useUpdateChecklist()

  // ── Form state ─────────────────────────────────────────────
  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [dueDate,     setDueDate]     = useState('')
  const [assignedTo,  setAssignedTo]  = useState<string | null>(null)
  const [priority,    setPriority]    = useState<Priority>('medium')

  // ── Populate form when data loads ─────────────────────────
  useEffect(() => {
    if (!checklist) return
    setTitle(checklist.title ?? '')
    setDescription(checklist.description ?? '')
    setDueDate(
      checklist.due_date
        ? new Date(checklist.due_date).toISOString().slice(0, 10)
        : ''
    )
    setAssignedTo(checklist.assigned_to ?? null)
    setPriority((checklist.priority as Priority) ?? 'medium')
  }, [checklist])

  // ── Save handler ───────────────────────────────────────────
  function handleSave() {
    if (!id || !title.trim()) return
    updateChecklist(
      {
        id,
        title:       title.trim(),
        description: description.trim() || undefined,
        dueDate:     dueDate ? new Date(dueDate).toISOString() : null,
        assignedTo:  assignedTo || null,
        priority,
      },
      {
        onSuccess: () => router.push(`/checklists/${id}`),
      }
    )
  }

  // ── Loading ───────────────────────────────────────────────
  if (isLoading) return <EditarChecklistSkeleton />

  if (isError || !checklist) {
    return (
      <div className="space-y-4">
        <Link
          href="/checklists"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para checklists
        </Link>
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          Checklist não encontrado. Verifique o link e tente novamente.
        </div>
      </div>
    )
  }

  const isCompleted =
    checklist.status === 'completed' || checklist.status === 'cancelled'

  return (
    <div className="space-y-6">
      <PageHeader title="Editar Checklist" description={checklist.title} />

      {isCompleted && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">
          Este checklist já foi concluído ou cancelado. Apenas os metadados podem ser alterados.
        </div>
      )}

      <div className="max-w-2xl space-y-5">

        {/* Título */}
        <div className="space-y-1.5">
          <Label htmlFor="title">
            Título <span className="text-destructive">*</span>
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nome do checklist"
            required
          />
        </div>

        {/* Descrição */}
        <div className="space-y-1.5">
          <Label htmlFor="description">Descrição</Label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Instruções ou observações sobre este checklist…"
            rows={3}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
          />
        </div>

        {/* Prazo */}
        <div className="space-y-1.5">
          <Label htmlFor="due_date">Prazo</Label>
          <Input
            id="due_date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        {/* Prioridade */}
        <div className="space-y-1.5">
          <Label>Prioridade</Label>
          <Select
            value={priority}
            onValueChange={(v) => setPriority(v as Priority)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Responsável */}
        <div className="space-y-1.5">
          <Label>Responsável</Label>
          <Select
            value={assignedTo ?? 'none'}
            onValueChange={(v) => setAssignedTo(v === 'none' ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sem responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem responsável</SelectItem>
              {users.map((u: User) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={handleSave}
            disabled={isSaving || !title.trim()}
          >
            {isSaving ? 'Salvando…' : 'Salvar alterações'}
          </Button>
          <Link href={`/checklists/${id}`}>
            <Button variant="outline" type="button">
              Cancelar
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
