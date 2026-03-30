'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Star, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { cn } from '@/lib/utils'
import {
  useCreateContact, useUpdateContact, useDeleteContact,
  type ContactInsert,
} from '@/hooks/use-suppliers'
import type { SupplierContact } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// MASKS
// ─────────────────────────────────────────────────────────────
function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (!d.length) return ''
  if (d.length <= 2)  return `(${d}`
  if (d.length <= 6)  return `(${d.slice(0,2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}

const ROLE_OPTIONS = ['Técnico', 'Comercial', 'Financeiro', 'Administrativo', 'Outro']

// ─────────────────────────────────────────────────────────────
// CONTACT FORM (inline)
// ─────────────────────────────────────────────────────────────
interface ContactFormData {
  name:       string
  role:       string
  phone:      string
  whatsapp:   string
  email:      string
  is_primary: boolean
}

const DEFAULT_CONTACT: ContactFormData = {
  name:       '',
  role:       '',
  phone:      '',
  whatsapp:   '',
  email:      '',
  is_primary: false,
}

interface ContactFormProps {
  supplierId:    string
  initial?:      Partial<ContactFormData>
  contactId?:    string
  onDone:        () => void
}

function ContactForm({ supplierId, initial, contactId, onDone }: ContactFormProps) {
  const createContact = useCreateContact()
  const updateContact = useUpdateContact()
  const isEditing = !!contactId

  const [form, setForm] = useState<ContactFormData>({
    ...DEFAULT_CONTACT,
    ...initial,
  })
  const [errors, setErrors] = useState<Partial<Record<keyof ContactFormData, string>>>({})

  function set<K extends keyof ContactFormData>(key: K, value: ContactFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof ContactFormData, string>> = {}
    if (!form.name.trim()) errs.name = 'Nome é obrigatório'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    const payload: ContactInsert = {
      supplier_id: supplierId,
      name:        form.name.trim(),
      role:        form.role  || null,
      phone:       form.phone || null,
      whatsapp:    form.whatsapp || null,
      email:       form.email || null,
      is_primary:  form.is_primary,
    }

    if (isEditing) {
      await updateContact.mutateAsync({ id: contactId, supplierId, data: payload })
    } else {
      await createContact.mutateAsync(payload)
    }
    onDone()
  }

  const isSaving = createContact.isPending || updateContact.isPending

  return (
    <form onSubmit={handleSubmit} className="bg-muted/30 border border-border rounded-lg p-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Nome */}
        <div className="space-y-1">
          <Label htmlFor="contact_name">
            Nome <span className="text-destructive">*</span>
          </Label>
          <Input
            id="contact_name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Nome do contato"
            className={cn('h-9', errors.name && 'border-destructive')}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        {/* Função */}
        <div className="space-y-1">
          <Label>Função</Label>
          <Select
            value={form.role || '__none__'}
            onValueChange={(v) => set('role', v === '__none__' ? '' : (v ?? ''))}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecionar..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sem função</SelectItem>
              {ROLE_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Telefone */}
        <div className="space-y-1">
          <Label htmlFor="contact_phone">Telefone</Label>
          <Input
            id="contact_phone"
            value={form.phone}
            onChange={(e) => set('phone', maskPhone(e.target.value))}
            placeholder="(00) 00000-0000"
            inputMode="tel"
            className="h-9"
          />
        </div>

        {/* WhatsApp */}
        <div className="space-y-1">
          <Label htmlFor="contact_whatsapp">WhatsApp</Label>
          <Input
            id="contact_whatsapp"
            value={form.whatsapp}
            onChange={(e) => set('whatsapp', maskPhone(e.target.value))}
            placeholder="(00) 00000-0000"
            inputMode="tel"
            className="h-9"
          />
        </div>

        {/* E-mail */}
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="contact_email">E-mail</Label>
          <Input
            id="contact_email"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="contato@empresa.com.br"
            className="h-9"
          />
        </div>
      </div>

      {/* Contato principal toggle */}
      <div className="flex items-center gap-3">
        <Switch
          id="is_primary"
          checked={form.is_primary}
          onCheckedChange={(v) => set('is_primary', v)}
        />
        <Label htmlFor="is_primary" className="cursor-pointer text-sm">
          Contato principal
        </Label>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onDone} disabled={isSaving}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={isSaving}>
          {isSaving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
          {isEditing ? 'Atualizar' : 'Salvar Contato'}
        </Button>
      </div>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────
// CONTACT LIST
// ─────────────────────────────────────────────────────────────
interface ContactListProps {
  supplierId: string
  contacts:   SupplierContact[]
}

export function ContactList({ supplierId, contacts }: ContactListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const deleteContact = useDeleteContact()

  return (
    <div className="space-y-3">
      {/* Existing contacts */}
      {contacts.length > 0 && (
        <div className="space-y-2">
          {contacts.map((contact) => (
            <div key={contact.id}>
              {editingId === contact.id ? (
                <ContactForm
                  supplierId={supplierId}
                  contactId={contact.id}
                  initial={{
                    name:       contact.name,
                    role:       contact.role  ?? '',
                    phone:      contact.phone ?? '',
                    whatsapp:   contact.whatsapp ?? '',
                    email:      contact.email ?? '',
                    is_primary: contact.is_primary,
                  }}
                  onDone={() => setEditingId(null)}
                />
              ) : (
                <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card group/row">
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{contact.name}</span>
                      {contact.is_primary && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium badge-amber border">
                          <Star className="w-2.5 h-2.5" />
                          Principal
                        </span>
                      )}
                      {contact.role && (
                        <span className="text-xs text-muted-foreground">· {contact.role}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                      {contact.phone && (
                        <span className="text-xs text-muted-foreground">{contact.phone}</span>
                      )}
                      {contact.email && (
                        <span className="text-xs text-muted-foreground">{contact.email}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 sm:opacity-0 sm:group-hover/row:opacity-100 opacity-100 transition-opacity">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingId(contact.id)}
                      className="h-7 w-7 p-0"
                      aria-label="Editar contato"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <ConfirmDialog
                      title="Remover contato"
                      description={`Tem certeza que deseja remover "${contact.name}"?`}
                      destructive
                      onConfirm={() => deleteContact.mutate({ id: contact.id, supplierId })}
                      trigger={
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          aria-label="Remover contato"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add new contact */}
      {addingNew ? (
        <ContactForm
          supplierId={supplierId}
          onDone={() => setAddingNew(false)}
        />
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => { setAddingNew(true); setEditingId(null) }}
          className="gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar Contato
        </Button>
      )}

      {contacts.length === 0 && !addingNew && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum contato cadastrado. Adicione o primeiro contato.
        </p>
      )}
    </div>
  )
}
