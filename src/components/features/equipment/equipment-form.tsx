'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/components/shared/photo-upload'
import { useCreateEquipment, useUpdateEquipment } from '@/hooks/use-equipment'
import { useSignedUrls } from '@/hooks/use-signed-urls'
import { Package, Camera, ImagePlus, X } from 'lucide-react'
import type { Equipment } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// FORM DATA
// ─────────────────────────────────────────────────────────────

interface FormData {
  name:           string
  category:       string
  location:       string
  serial_number:  string
  purchase_date:  string
  warranty_until: string
  status:         Equipment['status']
  notes:          string
}

const DEFAULT_FORM: FormData = {
  name:           '',
  category:       '',
  location:       '',
  serial_number:  '',
  purchase_date:  '',
  warranty_until: '',
  status:         'active',
  notes:          '',
}

const CATEGORIES = [
  'Brinquedo', 'Mobília', 'Cozinha', 'Elétrica',
  'Hidráulica', 'Decoração', 'Audiovisual', 'Climatização', 'Outro',
]

// ─────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────

interface Props {
  equipment?: Equipment
  onSuccess?: (id: string) => void
}

// ─────────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────────

export function EquipmentForm({ equipment, onSuccess }: Props) {
  const router   = useRouter()
  const isEditing = !!equipment

  const create = useCreateEquipment()
  const update = useUpdateEquipment()

  const [form, setForm] = useState<FormData>(() => {
    if (!equipment) return DEFAULT_FORM
    return {
      name:           equipment.name,
      category:       equipment.category ?? '',
      location:       equipment.location ?? '',
      serial_number:  equipment.serial_number ?? '',
      purchase_date:  equipment.purchase_date ?? '',
      warranty_until: equipment.warranty_until ?? '',
      status:         equipment.status,
      notes:          equipment.notes ?? '',
    }
  })

  const [errors, setErrors]         = useState<Partial<Record<keyof FormData, string>>>({})
  const [photoPath, setPhotoPath]   = useState<string | null>(equipment?.photo_url ?? null)
  const [uploading, setUploading]   = useState(false)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  // Signed URL da foto existente
  const { data: signedUrls = {} } = useSignedUrls(
    'equipment-photos',
    photoPath ? [photoPath] : []
  )
  const photoSrc = photoPath ? signedUrls[photoPath] : null

  function set(key: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormData, string>> = {}
    if (!form.name.trim()) errs.name = 'Nome é obrigatório'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Upload de foto ────────────────────────────────────────

  async function handleFile(file: File) {
    try {
      setUploading(true)
      const compressed = await compressImage(file, 1200, 0.8)
      const ext  = 'jpg'
      const path = `equipment/${Date.now()}.${ext}`
      const supabase = createClient()
      const { error } = await supabase.storage
        .from('equipment-photos')
        .upload(path, compressed, { contentType: 'image/jpeg', upsert: false })
      if (error) throw error
      setPhotoPath(path)
    } catch (err) {
      console.error('[photo-upload]', err)
    } finally {
      setUploading(false)
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  async function removePhoto() {
    if (!photoPath) return
    const supabase = createClient()
    await supabase.storage.from('equipment-photos').remove([photoPath])
    setPhotoPath(null)
  }

  // ── Submit ─────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    const payload: Partial<Equipment> = {
      name:           form.name.trim(),
      category:       form.category || null,
      location:       form.location || null,
      serial_number:  form.serial_number || null,
      purchase_date:  form.purchase_date || null,
      warranty_until: form.warranty_until || null,
      status:         form.status,
      notes:          form.notes || null,
      photo_url:      photoPath,
    }

    if (isEditing) {
      const updated = await update.mutateAsync({ id: equipment.id, data: payload })
      onSuccess ? onSuccess(updated.id) : router.push(`/equipamentos/${updated.id}`)
    } else {
      const created = await create.mutateAsync(payload)
      onSuccess ? onSuccess(created.id) : router.push(`/equipamentos/${created.id}`)
    }
  }

  const isSaving = create.isPending || update.isPending

  return (
    <form onSubmit={handleSubmit} className="space-y-8">

      {/* ── Seção 1: Dados Básicos ─────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground">Dados Básicos</h2>
        <Separator />

        {/* Nome */}
        <div className="space-y-1.5">
          <Label htmlFor="name">Nome <span className="text-destructive">*</span></Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Ex: Piscina de Bolinhas Grande, Tobogã Azul..."
            className={cn(errors.name && 'border-destructive')}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Categoria */}
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={form.category || '__none__'} onValueChange={(v: string | null) => set('category', v === '__none__' ? '' : (v ?? ''))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar categoria..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem categoria</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v: string | null) => set('status', v ?? 'active')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
                <SelectItem value="in_repair">Em Reparo</SelectItem>
                <SelectItem value="retired">Aposentado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Localização */}
        <div className="space-y-1.5">
          <Label htmlFor="location">Localização / Local de uso</Label>
          <Input
            id="location"
            value={form.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder="Ex: Salão Principal, Área externa, Cozinha..."
          />
        </div>
      </section>

      {/* ── Seção 2: Informações Técnicas ──────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground">Informações Técnicas</h2>
        <Separator />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="serial_number">Número de Série</Label>
            <Input
              id="serial_number"
              value={form.serial_number}
              onChange={(e) => set('serial_number', e.target.value)}
              placeholder="SN opcional..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="purchase_date">Data de Compra</Label>
            <Input
              id="purchase_date"
              type="date"
              value={form.purchase_date}
              onChange={(e) => set('purchase_date', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="warranty_until">Garantia até</Label>
            <Input
              id="warranty_until"
              type="date"
              value={form.warranty_until}
              onChange={(e) => set('warranty_until', e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Observações</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Informações adicionais sobre o equipamento..."
            className="min-h-[100px] resize-y"
          />
        </div>
      </section>

      {/* ── Seção 3: Foto ──────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground">Foto do Equipamento</h2>
        <Separator />

        {photoSrc ? (
          <div className="relative w-48 h-48">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoSrc} alt="Foto do equipamento" className="w-full h-full object-cover rounded-xl border" />
            <button
              type="button"
              onClick={removePhoto}
              className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-destructive text-white flex items-center justify-center shadow-md hover:bg-destructive/80 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-2">
            <div className="w-48 h-48 rounded-xl border-2 border-dashed border-border bg-muted/30 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              {uploading
                ? <Loader2 className="w-8 h-8 animate-spin" />
                : <Package className="w-10 h-10 opacity-40" />
              }
              {!uploading && <span className="text-xs">Sem foto</span>}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => cameraRef.current?.click()}
              >
                <Camera className="w-3.5 h-3.5 mr-1.5" />
                Câmera
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => galleryRef.current?.click()}
              >
                <ImagePlus className="w-3.5 h-3.5 mr-1.5" />
                Galeria
              </Button>
            </div>
          </div>
        )}

        {/* Inputs ocultos */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onFileChange}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />
      </section>

      {/* ── Ações ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={isSaving || uploading}>
          {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isEditing ? 'Salvar alterações' : 'Cadastrar equipamento'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={isSaving}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}
