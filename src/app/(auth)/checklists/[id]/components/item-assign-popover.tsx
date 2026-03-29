'use client'

import { useState } from 'react'
import { Search, UserX } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { UserAvatar } from '@/components/shared/user-avatar'
import { useUsers } from '@/hooks/use-users'
import { cn } from '@/lib/utils'
import type { User } from '@/types/database.types'

export type AssignedUser = Pick<User, 'id' | 'name' | 'avatar_url'>

interface ItemAssignPopoverProps {
  open: boolean
  onClose: () => void
  currentUser?: AssignedUser | null
  onAssign: (user: AssignedUser | null) => void
}

export function ItemAssignPopover({
  open,
  onClose,
  currentUser,
  onAssign,
}: ItemAssignPopoverProps) {
  const [search, setSearch] = useState('')
  const { data: users = [] } = useUsers({ isActive: true })

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()),
  )

  function handleAssign(user: AssignedUser | null) {
    onAssign(user)
    onClose()
    setSearch('')
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => { if (!isOpen) { onClose(); setSearch('') } }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-w-sm p-0 gap-0 overflow-hidden"
      >
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-sm">Atribuir responsável</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="p-4 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="w-full pl-8 pr-3 h-9 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* User list */}
        <div className="overflow-y-auto max-h-52 border-t border-border">
          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-6">
              Nenhum usuário encontrado
            </p>
          )}
          {filtered.map((user) => (
            <button
              key={user.id}
              onClick={() =>
                handleAssign({ id: user.id, name: user.name, avatar_url: user.avatar_url })
              }
              className={cn(
                'w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/60 transition-colors text-left',
                currentUser?.id === user.id &&
                  'bg-brand-50 dark:bg-brand-900/20',
              )}
            >
              <UserAvatar name={user.name} avatarUrl={user.avatar_url} size="sm" />
              <span className="flex-1 truncate">{user.name}</span>
              {currentUser?.id === user.id && (
                <span className="text-primary text-xs font-medium">✓</span>
              )}
            </button>
          ))}
        </div>

        {/* Remove option */}
        {currentUser && (
          <div className="p-3 border-t border-border">
            <button
              onClick={() => handleAssign(null)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
            >
              <UserX className="w-4 h-4" />
              Remover atribuição
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
