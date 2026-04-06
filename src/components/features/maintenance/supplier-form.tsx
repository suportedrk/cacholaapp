'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { SupplierRating } from './supplier-rating'
import { cn } from '@/lib/utils'
import {
  useCreateSupplier, useUpdateSupplier,
  SUPPLIER_CATEGORIES,
  type SupplierInsert,
} from '@/hooks/use-suppliers'
import type { MaintenanceSupplier } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// MASKS
// ─────────────────────────────────────────────────────────────
function maskCNPJ(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2)  return d
  if (d.length <= 5)  return `${d.slice(0,2)}.${d.slice(2)}`
  if (d.length <= 8)  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (!d.length) return ''
  if (d.length <= 2)  return `(${d}`
  if (d.length <= 6)  return `(${d.slice(0,2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
interface FormData {
  company_name: string
  trade_name:   string
  cnpj:         string
  category:     string
  rating:       number | null
  phone:        string
  email:        string
  address:      string
  notes:        string
  is_active:    boolean
}

const DEFAULT_FORM: FormData = {
  company_name: '',
  trade_name:   '',
  cnpj:         '',
  category:     '',
  rating:       null,
  phone:        '',
  email:        '',
  address:      '',
  notes:        '',
  is_active:    true,
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
interface Props {
  supplier?:  MaintenanceSupplier
  onSuccess?: (id: string) => void
  onCancel?:  () => void
}

export function SupplierForm({ supplier, onSuccess, onCancel }: Props) {
  const isEditing = !!supplier
  const createSupplier = useCreateSupplier()
  const updateSupplier = useUpdateSupplier()

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  const [form, setForm] = useState<FormData>(() =>
    supplier
      ? {
          company_name: supplier.company_name,
          trade_name:   supplier.trade_name  ?? '',
          cnpj:         supplier.cnpj        ?? '',
          category:     supplier.category    ?? '',
          rating:       supplier.rating,
          phone:        supplier.phone       ?? '',
          email:        supplier.email       ?? '',
          address:      supplier.address     ?? '',
          notes:        supplier.notes       ?? '',
          is_active:    supplier.is_active,
        }
      : DEFAULT_FORM,
  )

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormData, string>> = {}
    if (!form.company_name.trim()) errs.company_name = 'Razão social é obrigatória'
    if (form.company_name.trim().length > 0 && form.company_name.trim().length < 3)
      errs.company_name = 'Mínimo 3 caracteres'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    const payload: SupplierInsert = {
      company_name: form.company_name.trim(),
      trade_name:   form.trade_name.trim()  || null,
      cnpj:         form.cnpj.trim()        || null,
      category:     form.category           || null,
      rating:       form.rating,
      phone:        form.phone.trim()       || null,
      email:        form.email.trim()       || null,
      address:      form.address.trim()     || null,
      notes:        form.notes.trim()       || null,
      is_active:    form.is_active,
    }

    if (isEditing) {
      await updateSupplier.mutateAsync({ id: supplier.id, data: payload })
      onSuccess?.(supplier.id)
    } else {
      const { id } = await createSupplier.mutateAsync(payload)
      onSuccess?.(id)
    }
  }

  const isSaving = createSupplier.isPending || updateSupplier.isPending

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Dados da Empresa ─────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground">Dados da Empresa</h2>
        <Separator />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Razão Social */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="company_name">
              Razão Social <span className="text-destructive">*</span>
            </Label>
            <Input
              id="company_name"
              value={form.company_name}
              onChange={(e) => set('company_name', e.target.value)}
              placeholder="Nome jurídico da empresa"
              className={cn(errors.company_name && 'border-destructive')}
            />
            {errors.company_name && (
              <p className="text-xs text-destructive">{errors.company_name}</p>
            )}
          </div>

          {/* Nome Fantasia */}
          <div className="space-y-1.5">
            <Label htmlFor="trade_name">Nome Fantasia</Label>
            <Input
              id="trade_name"
              value={form.trade_name}
              onChange={(e) => set('trade_name', e.target.value)}
              placeholder="Nome comercial"
            />
          </div>

          {/* CNPJ */}
          <div className="space-y-1.5">
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input
              id="cnpj"
              value={form.cnpj}
              onChange={(e) => set('cnpj', maskCNPJ(e.target.value))}
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
            />
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select
              value={form.category || null}
              onValueChange={(v) => set('category', v ?? '')}
            >
              <SelectTrigger>
                {form.category
                  ? <span data-slot="select-value" className="flex flex-1 text-left">{form.category}</span>
                  : <SelectValue placeholder="Selecionar categoria..." />}
              </SelectTrigger>
              <SelectContent>
                {SUPPLIER_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Avaliação */}
          <div className="space-y-1.5">
            <Label>Avaliação</Label>
            <div className="flex items-center h-10">
              <SupplierRating
                value={form.rating}
                onChange={(r) => set('rating', r)}
                size="md"
              />
              {form.rating != null && (
                <button
                  type="button"
                  onClick={() => set('rating', null)}
                  className="ml-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Telefone */}
          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => set('phone', maskPhone(e.target.value))}
              placeholder="(00) 00000-0000"
              inputMode="tel"
            />
          </div>

          {/* E-mail */}
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="contato@empresa.com.br"
            />
          </div>
        </div>

        {/* Endereço */}
        <div className="space-y-1.5">
          <Label htmlFor="address">Endereço</Label>
          <Textarea
            id="address"
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
            placeholder="Rua, número, cidade, estado..."
            className="min-h-[80px] resize-y"
          />
        </div>

        {/* Observações */}
        <div className="space-y-1.5">
          <Label htmlFor="notes">Observações</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Condições especiais, horário de atendimento, etc..."
            className="min-h-[80px] resize-y"
          />
        </div>

        {/* Ativo */}
        <div className="flex items-center gap-3">
          <Switch
            id="is_active"
            checked={form.is_active}
            onCheckedChange={(checked) => set('is_active', checked)}
          />
          <Label htmlFor="is_active" className="cursor-pointer">
            Fornecedor ativo
          </Label>
        </div>
      </section>

      {/* ── Ações ─────────────────────────────────────────────── */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSaving}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">
          {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isEditing ? 'Salvar Alterações' : 'Cadastrar Fornecedor'}
        </Button>
      </div>
    </form>
  )
}
