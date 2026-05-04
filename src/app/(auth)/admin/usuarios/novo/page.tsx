'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, UserPlus } from 'lucide-react'
import { useIsReadOnly } from '@/hooks/use-read-only'
import { useAvailableSellersForInvite } from '@/hooks/use-sellers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select'
import { ROLE_LABELS, ROUTES } from '@/lib/constants'
import type { UserRole } from '@/types/database.types'
import { hasRole, VENDEDORA_ROLES } from '@/config/roles'
import { toast } from 'sonner'

const ROLES = Object.keys(ROLE_LABELS) as UserRole[]

export default function NovoUsuarioPage() {
  const router = useRouter()

  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [phone, setPhone]     = useState('')
  const [role, setRole]       = useState<UserRole>('vendedora')
  const [sellerId, setSellerId] = useState<string>('')
  const [isPending, setIsPending] = useState(false)

  const isReadOnly = useIsReadOnly()
  const queryClient = useQueryClient()
  const { data: availableSellers = [], isLoading: loadingSellers } = useAvailableSellersForInvite()

  const isVendedora = hasRole(role, VENDEDORA_ROLES)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (isVendedora && !sellerId) {
      toast.error('Selecione a vendedora a ser vinculada.')
      return
    }

    setIsPending(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          role,
          seller_id: isVendedora ? sellerId : null,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        toast.error(json.error ?? 'Erro ao criar usuário.')
        return
      }

      toast.success('Usuário criado com sucesso! Um e-mail de boas-vindas foi enviado.')
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      router.push(ROUTES.users)
    } catch {
      toast.error('Erro inesperado. Tente novamente.')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Novo Usuário</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Um e-mail de convite será enviado ao usuário
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nome completo *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do usuário"
            required
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail *</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="usuario@exemplo.com"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Telefone / WhatsApp</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(11) 99999-9999"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="role">Cargo *</Label>
          <Select
            value={role}
            onValueChange={(v) => {
              if (v) {
                setRole(v as UserRole)
                setSellerId('')
              }
            }}
          >
            <SelectTrigger className="w-full">
              <span data-slot="select-value" className="flex flex-1 text-left">
                {ROLE_LABELS[role]}
              </span>
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Campo condicional: só visível quando role=vendedora */}
        {isVendedora && (
          <div className="space-y-1.5">
            <Label htmlFor="seller">Vincular à vendedora *</Label>
            {loadingSellers ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground h-10">
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando vendedoras disponíveis...
              </div>
            ) : availableSellers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Nenhuma vendedora disponível para vinculação. Todas já possuem usuário ou estão inativas.
              </p>
            ) : (
              <Select
                value={sellerId}
                onValueChange={(v) => v && setSellerId(v)}
              >
                <SelectTrigger className="w-full">
                  <span data-slot="select-value" className="flex flex-1 text-left">
                    {sellerId
                      ? (availableSellers.find((s) => s.id === sellerId)?.name ?? 'Selecionar...')
                      : 'Selecionar vendedora...'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {availableSellers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <Button type="submit" disabled={isPending || isReadOnly}>
            {isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Criando...</>
            ) : (
              <><UserPlus className="w-4 h-4 mr-2" />Criar Usuário</>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push(ROUTES.users)}
            disabled={isPending}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}
