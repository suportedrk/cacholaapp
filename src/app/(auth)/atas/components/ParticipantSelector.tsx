'use client'

import { useState, useRef } from 'react'
import { Search, X, UserCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { PARTICIPANT_ROLE_LABELS } from '@/types/minutes'
import type { ParticipantRole, ParticipantDraft } from '@/types/minutes'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface UnitUser {
  id:         string
  name:       string
  avatar_url: string | null
  is_active:  boolean
}

interface Props {
  participants: ParticipantDraft[]
  unitUsers:    UnitUser[]
  onChange:     (participants: ParticipantDraft[]) => void
  disabled?:    boolean
}

// ─────────────────────────────────────────────────────────────
// Avatar helper
// ─────────────────────────────────────────────────────────────

function UserAvatar({ user, size = 'sm' }: { user: UnitUser; size?: 'sm' | 'xs' }) {
  const cls = size === 'xs'
    ? 'w-5 h-5 text-[10px]'
    : 'w-7 h-7 text-xs'

  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.name}
        className={cn(cls, 'rounded-full object-cover shrink-0')}
      />
    )
  }

  const initials = user.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <span className={cn(
      cls, 'rounded-full bg-muted flex items-center justify-center font-medium text-muted-foreground shrink-0'
    )}>
      {initials}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// ParticipantSelector
// ─────────────────────────────────────────────────────────────

export function ParticipantSelector({ participants, unitUsers, onChange, disabled }: Props) {
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const selectedIds = new Set(participants.map((p) => p.user_id))

  const filtered = unitUsers.filter((u) => {
    if (!u.is_active) return false
    if (selectedIds.has(u.id)) return false
    if (!search.trim()) return true
    return u.name.toLowerCase().includes(search.toLowerCase())
  })

  function handleAdd(user: UnitUser) {
    const draft: ParticipantDraft = {
      _key:    crypto.randomUUID(),
      user_id: user.id,
      role:    'participant',
    }
    onChange([...participants, draft])
    setSearch('')
    searchRef.current?.focus()
  }

  function handleRemove(key: string) {
    onChange(participants.filter((p) => p._key !== key))
  }

  function handleRoleChange(key: string, role: ParticipantRole) {
    onChange(participants.map((p) => p._key === key ? { ...p, role } : p))
  }

  // Get UnitUser for a participant (for display)
  function getUserForParticipant(p: ParticipantDraft): UnitUser | undefined {
    return unitUsers.find((u) => u.id === p.user_id)
  }

  return (
    <div className="space-y-3">
      {/* Search / add input */}
      {!disabled && (
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setIsOpen(true) }}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setTimeout(() => setIsOpen(false), 150)}
            placeholder="Buscar colaborador..."
            className={cn(
              'w-full h-10 pl-9 pr-4 rounded-lg border border-border bg-background',
              'text-sm text-foreground placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary',
              'transition-colors',
            )}
          />

          {/* Dropdown */}
          {isOpen && filtered.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-dropdown rounded-lg border border-border bg-card shadow-md overflow-hidden max-h-48 overflow-y-auto">
              {filtered.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleAdd(user) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-muted transition-colors"
                >
                  <UserAvatar user={user} size="xs" />
                  <span className="text-foreground">{user.name}</span>
                </button>
              ))}
            </div>
          )}

          {isOpen && search.trim() && filtered.length === 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-dropdown rounded-lg border border-border bg-card shadow-md px-3 py-2.5 text-sm text-muted-foreground">
              Nenhum colaborador encontrado.
            </div>
          )}
        </div>
      )}

      {/* Chips */}
      {participants.length === 0 ? (
        <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
          <UserCircle2 className="w-4 h-4" aria-hidden="true" />
          Nenhum participante adicionado.
        </div>
      ) : (
        <ul className="space-y-2">
          {participants.map((p) => {
            const user = getUserForParticipant(p)
            if (!user) return null

            return (
              <li
                key={p._key}
                className="flex items-center gap-3 p-2 rounded-lg border border-border bg-background"
              >
                <UserAvatar user={user} />

                <span className="flex-1 min-w-0 text-sm text-foreground truncate">
                  {user.name}
                </span>

                {/* Role select */}
                <Select
                  value={p.role}
                  onValueChange={(v) => handleRoleChange(p._key, v as ParticipantRole)}
                  disabled={disabled}
                >
                  <SelectTrigger size="sm" className="w-36 shrink-0">
                    <SelectValue>{PARTICIPANT_ROLE_LABELS[p.role]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(PARTICIPANT_ROLE_LABELS) as [ParticipantRole, string][]).map(
                      ([role, label]) => (
                        <SelectItem key={role} value={role}>{label}</SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>

                {/* Remove */}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleRemove(p._key)}
                    className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                    aria-label={`Remover ${user.name}`}
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
