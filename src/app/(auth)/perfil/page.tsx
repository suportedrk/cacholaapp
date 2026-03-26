'use client'

import { useState, useEffect } from 'react'
import { Loader2, Save, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { UserAvatar } from '@/components/shared/user-avatar'
import { useAuth } from '@/hooks/use-auth'
import { useUpdateUser } from '@/hooks/use-users'
import { ROLE_LABELS } from '@/lib/constants'

export default function PerfilPage() {
  const { profile } = useAuth()
  const updateUser = useUpdateUser()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notifEmail, setNotifEmail] = useState(true)
  const [notifPush, setNotifPush] = useState(true)
  const [notifEvents, setNotifEvents] = useState(true)
  const [notifMaintenance, setNotifMaintenance] = useState(true)
  const [notifChecklists, setNotifChecklists] = useState(true)

  useEffect(() => {
    if (profile) {
      setName(profile.name)
      setPhone(profile.phone ?? '')
      setNotifEmail(profile.preferences.notifications.email)
      setNotifPush(profile.preferences.notifications.push)
      setNotifEvents(profile.preferences.notifications.events)
      setNotifMaintenance(profile.preferences.notifications.maintenance)
      setNotifChecklists(profile.preferences.notifications.checklists)
    }
  }, [profile])

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return

    await updateUser.mutateAsync({
      id: profile.id,
      data: {
        name: name.trim(),
        phone: phone.trim() || null,
        preferences: {
          notifications: {
            email: notifEmail,
            push: notifPush,
            events: notifEvents,
            maintenance: notifMaintenance,
            checklists: notifChecklists,
          },
        },
      },
    })
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Meu Perfil</h1>
        <p className="mt-1 text-sm text-muted-foreground">Suas informações pessoais e preferências</p>
      </div>

      {/* Card avatar */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <UserAvatar name={profile.name} avatarUrl={profile.avatar_url} size="lg" />
            <button
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm hover:opacity-90 transition-opacity"
              aria-label="Alterar foto"
              title="Alterar foto (em breve)"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>
          <div>
            <p className="font-semibold text-foreground">{profile.name}</p>
            <p className="text-sm text-muted-foreground">{ROLE_LABELS[profile.role] ?? profile.role}</p>
            <p className="text-xs text-muted-foreground">{profile.email}</p>
          </div>
        </div>
      </div>

      {/* Formulário */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Dados pessoais */}
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <h2 className="text-base font-semibold text-foreground">Dados pessoais</h2>

          <div className="space-y-1.5">
            <Label htmlFor="name">Nome completo *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={profile.email} disabled className="bg-muted" />
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
        </div>

        {/* Notificações */}
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <h2 className="text-base font-semibold text-foreground">Preferências de notificação</h2>

          {[
            { id: 'email', label: 'E-mail', desc: 'Receber notificações por e-mail', value: notifEmail, set: setNotifEmail },
            { id: 'push', label: 'Push', desc: 'Notificações no navegador/app', value: notifPush, set: setNotifPush },
            { id: 'events', label: 'Eventos', desc: 'Lembretes e atualizações de eventos', value: notifEvents, set: setNotifEvents },
            { id: 'maintenance', label: 'Manutenção', desc: 'Ordens de serviço atribuídas', value: notifMaintenance, set: setNotifMaintenance },
            { id: 'checklists', label: 'Checklists', desc: 'Checklists pendentes e vencidos', value: notifChecklists, set: setNotifChecklists },
          ].map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch
                id={`notif-${item.id}`}
                checked={item.value}
                onCheckedChange={item.set}
              />
            </div>
          ))}
        </div>

        {/* Botão salvar */}
        <Button type="submit" disabled={updateUser.isPending} className="w-full sm:w-auto">
          {updateUser.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
          ) : (
            <><Save className="w-4 h-4 mr-2" />Salvar preferências</>
          )}
        </Button>
      </form>
    </div>
  )
}
