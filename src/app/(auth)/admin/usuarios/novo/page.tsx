'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, UserPlus } from 'lucide-react'
import { useIsReadOnly } from '@/hooks/use-read-only'
import { useAvailableSellersForInvite } from '@/hooks/use-sellers'
import { useUnits } from '@/hooks/use-units'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select'
import { ROLE_LABELS, ROUTES } from '@/lib/constants'
import type { UserRole } from '@/types/database.types'
import { hasRole, VENDEDORA_ROLES, UNIT_OPTIONAL_AT_CREATION_ROLES } from '@/config/roles'
import { toast } from 'sonner'

const ROLES = Object.keys(ROLE_LABELS) as UserRole[]

export default function NovoUsuarioPage() {
  const router = useRouter()

  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [phone, setPhone]     = useState('')
  const [role, setRole]       = useState<UserRole>('vendedora')
  const [sellerId, setSellerId] = useState<string>('')
  const [selectedUnits, setSelectedUnits] = useState<string[]>([])
  const [defaultUnitId, setDefaultUnitId] = useState<string>('')
  const [isPending, setIsPending] = useState(false)

  const isReadOnly = useIsReadOnly()
  const queryClient = useQueryClient()
  const { data: availableSellers = [], isLoading: loadingSellers } = useAvailableSellersForInvite()
  const { data: units = [], isLoading: loadingUnits } = useUnits()

  const isVendedora = hasRole(role, VENDEDORA_ROLES)
  const unitRequired = !hasRole(role, UNIT_OPTIONAL_AT_CREATION_ROLES)
  const activeUnits = units.filter((u) => u.is_active)

  function toggleUnit(id: string) {
    if (selectedUnits.includes(id)) {
      const next = selectedUnits.filter((x) => x !== id)
      setSelectedUnits(next)
      if (defaultUnitId === id) setDefaultUnitId(next[0] ?? '')
    } else {
      setSelectedUnits([...selectedUnits, id])
      if (!defaultUnitId) setDefaultUnitId(id)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (isVendedora && !sellerId) {
      toast.error('Selecione a vendedora a ser vinculada.')
      return
    }

    if (unitRequired && selectedUnits.length === 0) {
      toast.error('Selecione ao menos 1 unidade para este cargo.')
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
          units: selectedUnits.map((unit_id) => ({
            unit_id,
            is_default: unit_id === defaultUnitId,
          })),
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        toast.error(json.error ?? 'Erro ao criar usuário.')
        return
      }

      if (json.warning) {
        toast.warning(json.warning, { duration: 10000 })
      } else {
        toast.success('Usuário criado com sucesso! Um e-mail de boas-vindas foi enviado.')
      }
      // refetchType: 'all' força o refetch mesmo da lista que está inativa (não
      // montada) — sem isso a listagem volta com cache velho e o novo usuário só
      // aparece após F5 manual.
      await queryClient.invalidateQueries({ queryKey: ['users'], refetchType: 'all' })
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

        {/* Unidades — multisseleção com uma marcada como padrão */}
        <div className="space-y-1.5">
          <Label>Unidades {unitRequired ? '*' : <span className="text-muted-foreground font-normal">(opcional)</span>}</Label>
          <p className="text-xs text-muted-foreground">
            {unitRequired
              ? 'Selecione as unidades que o usuário acessa. A marcada como padrão é a que abre no login.'
              : 'Cargo de visão global (vê todas as unidades) — pode ficar sem unidade específica.'}
          </p>
          {loadingUnits ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground h-10">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando unidades...
            </div>
          ) : activeUnits.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Nenhuma unidade ativa disponível.</p>
          ) : (
            <div className="space-y-1 rounded-lg border border-border p-2">
              {activeUnits.map((u) => {
                const checked = selectedUnits.includes(u.id)
                return (
                  <div key={u.id} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50">
                    <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                      <Checkbox checked={checked} onCheckedChange={() => toggleUnit(u.id)} />
                      <span className="text-sm text-foreground truncate">{u.name}</span>
                    </label>
                    {checked && (
                      defaultUnitId === u.id ? (
                        <span className="text-xs text-primary font-medium shrink-0">Padrão</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDefaultUnitId(u.id)}
                          className="text-xs text-muted-foreground hover:text-foreground shrink-0 inline-flex items-center min-h-[44px] px-2 -my-2"
                        >
                          Definir padrão
                        </button>
                      )
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

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
