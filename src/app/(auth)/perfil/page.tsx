'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, Save, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { UserAvatar } from '@/components/shared/user-avatar'
import { useAuth } from '@/hooks/use-auth'
import { useUpdateUser } from '@/hooks/use-users'
import { ROLE_LABELS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const AVATAR_BUCKET = 'user-avatars'

async function compressImage(file: File, maxDimension = 600, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const { width, height } = img
      let w = width, h = height
      if (w > maxDimension || h > maxDimension) {
        if (w > h) { h = Math.round((h * maxDimension) / w); w = maxDimension }
        else { w = Math.round((w * maxDimension) / h); h = maxDimension }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('canvas unavailable'))
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('toBlob null')), 'image/jpeg', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('load failed')) }
    img.src = objectUrl
  })
}

export default function PerfilPage() {
  const { profile } = useAuth()
  const updateUser = useUpdateUser()
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notifEmail, setNotifEmail] = useState(true)
  const [notifPush, setNotifPush] = useState(true)
  const [notifEvents, setNotifEvents] = useState(true)
  const [notifMaintenance, setNotifMaintenance] = useState(true)
  const [notifChecklists, setNotifChecklists] = useState(true)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null)

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

  async function handleAvatarChange(file: File | null | undefined) {
    if (!file || !profile) return
    setAvatarUploading(true)
    try {
      const blob = await compressImage(file)
      const storagePath = `${profile.id}/avatar.jpg`
      const supabase = createClient()

      // Remove old file if exists (best-effort)
      await supabase.storage.from(AVATAR_BUCKET).remove([storagePath])

      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: true })
      if (uploadError) throw uploadError

      // Long-lived signed URL (1 year = 31536000s)
      const { data: signedData, error: signError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .createSignedUrl(storagePath, 31536000)
      if (signError) throw signError

      const signedUrl = signedData.signedUrl

      await updateUser.mutateAsync({ id: profile.id, data: { avatar_url: signedUrl } })
      setLocalAvatarUrl(signedUrl)
      toast.success('Foto de perfil atualizada!')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao atualizar foto de perfil.')
    } finally {
      setAvatarUploading(false)
    }
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

  const displayAvatarUrl = localAvatarUrl ?? profile.avatar_url

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
          <div className="relative w-fit">
            <UserAvatar name={profile.name} avatarUrl={displayAvatarUrl} size="lg" />
            <button
              type="button"
              className="absolute bottom-0 right-0 !w-6 !h-6 !min-w-0 !min-h-0 rounded-full bg-card border border-border shadow-xs flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50"
              aria-label="Alterar foto de perfil"
              disabled={avatarUploading}
              onClick={() => avatarInputRef.current?.click()}
            >
              {avatarUploading
                ? <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                : <Camera className="w-3 h-3 text-muted-foreground" />
              }
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => handleAvatarChange(e.target.files?.[0])}
              onClick={(e) => ((e.target as HTMLInputElement).value = '')}
            />
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
