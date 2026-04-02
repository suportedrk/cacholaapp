'use client'

import { Building2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface Step1Data {
  name: string
  slug: string
  address: string
  phone: string
}

interface Props {
  data: Step1Data
  onChange: (data: Partial<Step1Data>) => void
  isEditing: boolean  // true = completar unidade existente, false = criar do zero
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function Step1Dados({ data, onChange, isEditing }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="icon-brand p-2 rounded-lg">
          <Building2 className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Dados da Unidade</h2>
          <p className="text-sm text-muted-foreground">
            {isEditing ? 'Revise e complete os dados cadastrais.' : 'Preencha os dados da nova unidade.'}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Nome */}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="unit-name">
            Nome da unidade <span className="text-destructive">*</span>
          </Label>
          <Input
            id="unit-name"
            placeholder="Ex: Buffet Cachola Moema"
            value={data.name}
            onChange={(e) => {
              const name = e.target.value
              const newSlug = data.slug || (!isEditing ? slugify(name) : data.slug)
              onChange({ name, slug: newSlug })
            }}
            disabled={isEditing}
            className={isEditing ? 'bg-muted/50' : ''}
          />
          {isEditing && (
            <p className="text-xs text-muted-foreground">
              O nome não pode ser alterado aqui. Acesse a edição completa da unidade.
            </p>
          )}
        </div>

        {/* Slug */}
        <div className="space-y-2">
          <Label htmlFor="unit-slug">
            Slug (identificador único) <span className="text-destructive">*</span>
          </Label>
          <Input
            id="unit-slug"
            placeholder="Ex: moema"
            value={data.slug}
            onChange={(e) => onChange({ slug: slugify(e.target.value) })}
            disabled={isEditing}
            className={isEditing ? 'bg-muted/50' : ''}
          />
          {!isEditing && (
            <p className="text-xs text-muted-foreground">
              Apenas letras minúsculas, números e hífens. Usado nas URLs.
            </p>
          )}
        </div>

        {/* Telefone */}
        <div className="space-y-2">
          <Label htmlFor="unit-phone">Telefone</Label>
          <Input
            id="unit-phone"
            placeholder="(11) 99999-9999"
            value={data.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
          />
        </div>

        {/* Endereço */}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="unit-address">Endereço</Label>
          <Input
            id="unit-address"
            placeholder="Ex: Rua das Flores, 123 – Pinheiros, São Paulo/SP"
            value={data.address}
            onChange={(e) => onChange({ address: e.target.value })}
          />
        </div>
      </div>

      {/* Info */}
      <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        <p>
          <strong className="text-foreground">Logo e cor de destaque</strong> podem ser configurados nas{' '}
          <span className="text-primary">Configurações → Identidade Visual</span> após o setup.
        </p>
      </div>
    </div>
  )
}
