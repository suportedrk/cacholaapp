'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { ClipboardList, ImagePlus } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { compressImage, PhotoThumb } from '@/components/shared/photo-upload'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { useCreateTicket, type TicketInsert } from '@/hooks/use-tickets'
import { useSectors } from '@/hooks/use-sectors'
import { useMaintenanceCategories } from '@/hooks/use-maintenance-categories'
import { useEquipment } from '@/hooks/use-equipment'
import { useActiveUsersForUnit } from '@/hooks/use-users-for-unit'
import { useMaintenanceExecutorOptions } from '@/hooks/use-maintenance-executors'
import { useAuth } from '@/hooks/use-auth'
import { useUnitStore } from '@/stores/unit-store'
import type { TicketNature, TicketUrgency } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────
const NATURE_OPTIONS: { value: TicketNature; label: string }[] = [
  { value: 'preventiva',        label: 'Preventiva'        },
  { value: 'corretiva',         label: 'Corretiva'         },
  { value: 'emergencial',       label: 'Emergencial'       },
  { value: 'melhoria_estetica', label: 'Melhoria/Estética' },
]

const URGENCY_OPTIONS: { value: TicketUrgency; label: string }[] = [
  { value: 'critical', label: 'Crítico' },
  { value: 'high',     label: 'Alto'    },
  { value: 'medium',   label: 'Médio'   },
  { value: 'low',      label: 'Baixo'   },
]

const MAX_PHOTOS = 5
const PHOTO_BUCKET = 'maintenance-photos'

// Foto em staging: comprimida em memória, com preview. Só sobe ao salvar o chamado.
type StagedPhoto = { id: string; blob: Blob; previewUrl: string }

// ─────────────────────────────────────────────────────────────
// FORM STATE
// ─────────────────────────────────────────────────────────────
type FormState = {
  title:        string
  description:  string
  unit_id:      string
  sector_id:    string
  category_id:  string
  equipment_id: string
  nature:       TicketNature
  urgency:      TicketUrgency
  opened_by:    string  // solicitante (default = usuário logado, editável)
  assigned_to_user_id: string  // responsável pelo chamado (dono/gestor, opcional)
}

const INITIAL: FormState = {
  title:        '',
  description:  '',
  unit_id:      '',
  sector_id:    '',
  category_id:  '',
  equipment_id: '',
  nature:       'corretiva',
  urgency:      'medium',
  opened_by:    '',
  assigned_to_user_id: '',
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
interface TicketFormModalProps {
  open:       boolean
  onClose:    () => void
  onCreated?: (id: string) => void
}

export function TicketFormModal({ open, onClose, onCreated }: TicketFormModalProps) {
  const [form, setForm]     = useState<FormState>(INITIAL)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})

  const { profile } = useAuth()
  const activeUnitId = useUnitStore((s) => s.activeUnitId)
  const availableUnits = useUnitStore((s) => s.userUnits)

  // Seletor de unidade sempre visível quando o usuário acessa >1 unidade.
  const showUnitSelector = availableUnits.length > 1

  // Unidade efetiva: escolha do form > unidade ativa do store > única unidade do usuário.
  const effectiveUnitId =
    form.unit_id ||
    activeUnitId ||
    (availableUnits.length === 1 ? availableUnits[0].unit_id : null)

  // Setores e categorias são globais (migration 152) — lista única para todas as unidades.
  // Equipamentos continuam por unidade (filtram pela unidade efetiva).
  const { data: sectors    = [] } = useSectors(true)
  const { data: categories = [] } = useMaintenanceCategories(true)
  const { data: equipments = [] } = useEquipment({ status: ['active', 'in_repair'] }, effectiveUnitId)

  // Solicitantes via RPC SECURITY DEFINER (a RLS de users só deixa o técnico ver a si mesmo).
  const { data: requesters = [] } = useActiveUsersForUnit(effectiveUnitId)
  // Responsável pelo chamado: equipe de manutenção da unidade (RPC gated por
  // manutencao 'edit'). Todo cargo que pode criar chamado também tem 'edit', então
  // a lista nunca vem vazia por permissão na abertura.
  const { data: assignees = [] } = useMaintenanceExecutorOptions(effectiveUnitId)

  // Fotos em staging (memória) + flag de submit cobrindo criação + upload.
  const [stagedPhotos, setStagedPhotos] = useState<StagedPhoto[]>([])
  const [submitting, setSubmitting]     = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const stagedRef     = useRef<StagedPhoto[]>([])
  const photoIdRef    = useRef(0)
  stagedRef.current = stagedPhotos  // espelho p/ cleanup no unmount sem stale closure

  // NÃO navega no callback do hook: navegação manual após upload das fotos.
  const createTicket = useCreateTicket()

  // Reset form when dialog opens — solicitante default = usuário logado;
  // unidade pré-selecionada com a ativa do store (multi-unidade pode trocar).
  useEffect(() => {
    if (open) {
      setForm({ ...INITIAL, opened_by: profile?.id ?? '', unit_id: activeUnitId ?? '' })
      setErrors({})
      // Limpa fotos de uma abertura anterior (revoga URLs antigas).
      stagedRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl))
      setStagedPhotos([])
    }
  }, [open, profile?.id, activeUnitId])

  // Cleanup no unmount: revoga todos os object URLs pendentes.
  useEffect(() => {
    return () => {
      stagedRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl))
    }
  }, [])

  async function handleAddPhotos(files: FileList | null) {
    if (!files) return
    for (const file of Array.from(files)) {
      if (stagedRef.current.length >= MAX_PHOTOS) {
        toast.error(`Máximo de ${MAX_PHOTOS} fotos por chamado.`)
        break
      }
      try {
        const blob = await compressImage(file, 1200, 0.8)
        const previewUrl = URL.createObjectURL(blob)
        photoIdRef.current += 1
        const staged: StagedPhoto = { id: `p${photoIdRef.current}`, blob, previewUrl }
        stagedRef.current = [...stagedRef.current, staged]
        setStagedPhotos(stagedRef.current)
      } catch {
        toast.error('Não foi possível processar a imagem.')
      }
    }
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  function removeStagedPhoto(id: string) {
    const found = stagedRef.current.find((p) => p.id === id)
    if (found) URL.revokeObjectURL(found.previewUrl)
    stagedRef.current = stagedRef.current.filter((p) => p.id !== id)
    setStagedPhotos(stagedRef.current)
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      // RESET CASCADE — quando troca a unidade, limpa todos os dropdowns dependentes
      // (sector, category, item, equipment). Previne corrupção silenciosa: super_admin
      // escolhe setor de Pinheiros, depois muda para Moema; sem o reset, o FK ficaria
      // pendurado entre unidades.
      if (key === 'unit_id') {
        return {
          ...prev,
          unit_id:      value as string,
          sector_id:    '',
          category_id:  '',
          equipment_id: '',
          // Solicitante volta ao usuário logado: a lista é por unidade.
          opened_by:    profile?.id ?? '',
          // Responsável também é por unidade — limpa ao trocar.
          assigned_to_user_id: '',
        }
      }
      return { ...prev, [key]: value }
    })
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const e: typeof errors = {}
    if (!form.title.trim())   e.title  = 'Título é obrigatório'
    if (!form.nature)         e.nature  = 'Natureza é obrigatória'
    if (!form.urgency)        e.urgency = 'Urgência é obrigatória'
    if (!effectiveUnitId) {
      e.unit_id = 'Unidade é obrigatória'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // Sobe as fotos em staging após o ticket existir. Best-effort: retorna nº de falhas.
  async function uploadStagedPhotos(ticketId: string, unitId: string): Promise<number> {
    if (stagedRef.current.length === 0) return 0
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    let failed = 0
    for (const photo of stagedRef.current) {
      try {
        photoIdRef.current += 1
        const path = `${unitId}/${ticketId}/${photoIdRef.current}-${photo.id}.jpg`
        const { error: upErr } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(path, photo.blob, { contentType: 'image/jpeg', upsert: false })
        if (upErr) throw upErr
        const { error: insErr } = await supabase
          .from('maintenance_ticket_photos')
          .insert({ ticket_id: ticketId, url: path, uploaded_by: user?.id ?? null, phase: 'abertura' })
        if (insErr) throw insErr
      } catch {
        failed++
      }
    }
    return failed
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate() || submitting) return
    if (!effectiveUnitId) return  // guard final — submit desabilitado deveria impedir, mas defensivo

    const payload: TicketInsert = {
      title:        form.title.trim(),
      nature:       form.nature,
      urgency:      form.urgency,
      unit_id:      effectiveUnitId,
      description:  form.description.trim() || null,
      sector_id:    form.sector_id    || null,
      category_id:  form.category_id  || null,
      equipment_id: form.equipment_id || null,
      // Solicitante: escolha do form, ou usuário logado como fallback.
      opened_by:    form.opened_by || profile?.id || undefined,
      // Responsável pelo chamado: opcional — null quando não designado.
      assigned_to_user_id: form.assigned_to_user_id || null,
    }

    setSubmitting(true)
    try {
      // 1. Cria o ticket (hook mostra toast de sucesso + auditLog).
      const ticket = await createTicket.mutateAsync(payload)

      // 2. Upload best-effort das fotos. Chamado nunca é perdido se a foto falhar.
      const failed = await uploadStagedPhotos(ticket.id, effectiveUnitId)
      if (failed > 0) {
        toast.error(
          `Chamado criado, mas ${failed} foto${failed !== 1 ? 's' : ''} não ${failed !== 1 ? 'subiram' : 'subiu'}. Reenvie no detalhe do chamado.`,
          { duration: 6000 }
        )
      }

      // 3. Cleanup + navega para o detalhe.
      stagedRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl))
      stagedRef.current = []
      onClose()
      onCreated?.(ticket.id)
    } catch {
      // createTicket.onError já mostrou o toast de erro do chamado.
    } finally {
      setSubmitting(false)
    }
  }

  const submitDisabled = submitting || !effectiveUnitId

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Novo Chamado
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 px-6 pb-4 space-y-4 pt-2">

          {/* Unidade — sempre visível quando o usuário acessa mais de uma unidade */}
          {showUnitSelector && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Unidade <span className="text-destructive">*</span>
              </label>
              <Select
                value={form.unit_id || 'none'}
                onValueChange={(v) => set('unit_id', v === 'none' ? '' : (v ?? ''))}
              >
                <SelectTrigger className={cn('w-full', errors.unit_id ? 'border-destructive' : '')}>
                  <span data-slot="select-value">
                    {form.unit_id
                      ? (availableUnits.find((u) => u.unit_id === form.unit_id)?.unit?.name ?? 'Selecionar...')
                      : 'Selecionar...'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {availableUnits.length === 0 && (
                    <SelectItem value="none" disabled>Sem unidades disponíveis</SelectItem>
                  )}
                  {availableUnits.map((u) => (
                    <SelectItem key={u.unit_id} value={u.unit_id}>{u.unit?.name ?? u.unit_id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.unit_id && (
                <p className="text-xs text-destructive">{errors.unit_id}</p>
              )}
            </div>
          )}

          {/* Título */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Título <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder='Ex: "Torneira da cozinha com vazamento"'
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-border-focus transition-colors placeholder:text-text-tertiary"
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title}</p>
            )}
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Descrição
            </label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Descreva o problema com mais detalhes..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-border-focus transition-colors resize-none placeholder:text-text-tertiary"
            />
          </div>

          {/* Natureza + Urgência (row) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Natureza <span className="text-destructive">*</span>
              </label>
              <Select
                value={form.nature}
                onValueChange={(v) => set('nature', (v ?? '') as TicketNature)}
              >
                <SelectTrigger className={cn('w-full', errors.nature ? 'border-destructive' : '')}>
                  <span data-slot="select-value">
                    {NATURE_OPTIONS.find((o) => o.value === form.nature)?.label ?? 'Selecionar...'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {NATURE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.nature && (
                <p className="text-xs text-destructive">{errors.nature}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Urgência <span className="text-destructive">*</span>
              </label>
              <Select
                value={form.urgency}
                onValueChange={(v) => set('urgency', (v ?? '') as TicketUrgency)}
              >
                <SelectTrigger className={cn('w-full', errors.urgency ? 'border-destructive' : '')}>
                  <span data-slot="select-value">
                    {URGENCY_OPTIONS.find((o) => o.value === form.urgency)?.label ?? 'Selecionar...'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {URGENCY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.urgency && (
                <p className="text-xs text-destructive">{errors.urgency}</p>
              )}
            </div>
          </div>

          {/* Solicitante — quem pediu o reparo. Default = usuário logado, editável. */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">Solicitante</label>
            <Select
              value={form.opened_by || 'none'}
              onValueChange={(v) => set('opened_by', v === 'none' ? '' : (v ?? ''))}
            >
              <SelectTrigger className="w-full">
                <span data-slot="select-value">
                  {form.opened_by
                    ? (requesters.find((u) => u.id === form.opened_by)?.name ?? 'Eu')
                    : 'Eu'}
                </span>
              </SelectTrigger>
              <SelectContent>
                {requesters.length === 0 && (
                  <SelectItem value="none" disabled>Carregando usuários...</SelectItem>
                )}
                {requesters.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-text-tertiary">
              Quem reportou o problema. Por padrão, você.
            </p>
          </div>

          {/* Responsável pelo chamado — dono/gestor que conduz o chamado. Opcional. */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">Responsável pelo chamado</label>
            <Select
              value={form.assigned_to_user_id || 'none'}
              onValueChange={(v) => set('assigned_to_user_id', v === 'none' ? '' : (v ?? ''))}
            >
              <SelectTrigger className="w-full">
                <span data-slot="select-value">
                  {form.assigned_to_user_id
                    ? (assignees.find((u) => u.id === form.assigned_to_user_id)?.name ?? 'Selecionar...')
                    : 'Sem responsável'}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem responsável</SelectItem>
                {assignees.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-text-tertiary">
              Quem vai conduzir o chamado. Pode ser definido depois, na triagem.
            </p>
          </div>

          {/* Setor */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">Setor</label>
            <Select
              value={form.sector_id || 'none'}
              onValueChange={(v) => set('sector_id', v === 'none' ? '' : (v ?? ''))}
            >
              <SelectTrigger className="w-full">
                <span data-slot="select-value">
                  {form.sector_id
                    ? (sectors.find((s) => s.id === form.sector_id)?.name ?? 'Nenhum')
                    : 'Nenhum'}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {sectors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">Categoria</label>
            <Select
              value={form.category_id || 'none'}
              onValueChange={(v) => set('category_id', v === 'none' ? '' : (v ?? ''))}
            >
              <SelectTrigger className="w-full">
                <span data-slot="select-value">
                  {form.category_id
                    ? (categories.find((c) => c.id === form.category_id)?.name ?? 'Nenhuma')
                    : 'Nenhuma'}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: c.color ?? '#888' }}
                      />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Equipamento */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">Equipamento</label>
            <Select
              value={form.equipment_id || 'none'}
              onValueChange={(v) => set('equipment_id', v === 'none' ? '' : (v ?? ''))}
            >
              <SelectTrigger className="w-full">
                <span data-slot="select-value">
                  {form.equipment_id
                    ? (equipments.find((e) => e.id === form.equipment_id)?.name ?? 'Nenhum equipamento')
                    : 'Nenhum equipamento'}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum equipamento</SelectItem>
                {equipments.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    <span className="flex items-center gap-2">
                      {e.name}
                      {e.category && (
                        <span className="text-xs text-text-tertiary">· {e.category}</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fotos de abertura — staging em memória, sobem ao salvar */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">Fotos (abertura)</label>
            <div className="grid grid-cols-3 gap-2">
              {stagedPhotos.map((p) => (
                <PhotoThumb
                  key={p.id}
                  src={p.previewUrl}
                  alt="Foto do chamado"
                  onRemove={submitting ? undefined : () => removeStagedPhoto(p.id)}
                  disabled={submitting}
                />
              ))}
              {stagedPhotos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={submitting}
                  className="aspect-[4/3] rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-text-tertiary hover:border-border-focus hover:text-text-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ImagePlus className="w-5 h-5" />
                  <span className="text-xs">Adicionar</span>
                </button>
              )}
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleAddPhotos(e.target.files)}
            />
            <p className="text-xs text-text-tertiary">
              Até {MAX_PHOTOS} fotos. Enviadas ao abrir o chamado.
            </p>
          </div>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit as any}
            disabled={submitDisabled}
          >
            {submitting ? 'Abrindo...' : 'Abrir Chamado'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
