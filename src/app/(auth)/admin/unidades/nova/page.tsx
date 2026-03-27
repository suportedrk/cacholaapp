'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateUnit } from '@/hooks/use-units'
import { ROUTES } from '@/lib/constants'

function toSlug(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function NovaUnidadePage() {
  const router = useRouter()
  const { mutate: createUnit, isPending } = useCreateUnit()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)

  function handleNameChange(v: string) {
    setName(v)
    if (!slugEdited) setSlug(toSlug(v))
  }

  function handleSlugChange(v: string) {
    setSlugEdited(true)
    setSlug(toSlug(v))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) return

    createUnit(
      { name: name.trim(), slug, address: address.trim() || null, phone: phone.trim() || null },
      { onSuccess: () => router.push(ROUTES.units) }
    )
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Voltar">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Nova Unidade</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Cadastrar uma nova filial ou local de atendimento</p>
        </div>
      </div>

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="space-y-5 bg-card rounded-xl border border-border p-6">
        <div className="space-y-2">
          <Label htmlFor="name">Nome da Unidade *</Label>
          <Input
            id="name"
            placeholder="Ex: Buffet Cachola Pinheiros"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">
            Slug *
            <span className="text-xs text-muted-foreground ml-2 font-normal">(identificador único, sem espaços)</span>
          </Label>
          <Input
            id="slug"
            placeholder="buffet-cachola-pinheiros"
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            className="font-mono text-sm"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Endereço</Label>
          <Input
            id="address"
            placeholder="Rua das Flores, 123 — São Paulo, SP"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            placeholder="(11) 99999-9999"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending || !name.trim() || !slug.trim()} className="flex-1">
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Criar Unidade
          </Button>
        </div>
      </form>
    </div>
  )
}
