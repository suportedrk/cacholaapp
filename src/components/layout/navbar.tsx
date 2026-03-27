'use client'

import { useRouter } from 'next/navigation'
import { Menu, LogOut, User as UserIcon, Settings } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { NotificationBell } from './notification-bell'
import { Breadcrumbs } from './breadcrumbs'
import { useAuth } from '@/hooks/use-auth'
import { getInitials, getAvatarColor, cn } from '@/lib/utils'
import { ROUTES } from '@/lib/constants'

interface NavbarProps {
  onMenuClick: () => void
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const router = useRouter()
  const { profile, signOut } = useAuth()
  const initials = profile ? getInitials(profile.name) : 'U'
  const avatarColor = profile ? getAvatarColor(profile.name) : ''

  return (
    <header className="sticky top-0 z-20 h-16 flex items-center gap-3 px-4 bg-card border-b border-border shadow-sm">
      {/* Botão hamburguer — mobile */}
      <button
        onClick={onMenuClick}
        className={cn(
          'lg:hidden p-2 rounded-lg text-muted-foreground',
          'hover:bg-accent hover:text-foreground',
          'transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center'
        )}
        aria-label="Abrir menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Logo — mobile */}
      <div className="lg:hidden flex items-center gap-2 mr-auto">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-xs font-bold text-primary-foreground">C</span>
        </div>
        <span className="font-semibold text-sm text-foreground">Cachola OS</span>
      </div>

      {/* Breadcrumbs — desktop */}
      <div className="hidden lg:flex flex-1">
        <Breadcrumbs />
      </div>

      {/* Espaço flex no mobile */}
      <div className="flex-1 lg:hidden" />

      {/* Ações direita */}
      <div className="flex items-center gap-1">
        <NotificationBell />

        {/* Avatar + Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              'p-1 rounded-lg cursor-pointer',
              'hover:bg-accent transition-colors',
              'min-h-[44px] min-w-[44px] flex items-center justify-center outline-none'
            )}
            aria-label="Menu do usuário"
          >
            <Avatar className="w-8 h-8">
              <AvatarImage src={profile?.avatar_url ?? undefined} alt={profile?.name ?? 'Usuário'} />
              <AvatarFallback className={cn('text-xs font-semibold', avatarColor)}>
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{profile?.name ?? 'Usuário'}</p>
                <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => router.push(ROUTES.profile)}
            >
              <UserIcon className="w-4 h-4 mr-2" />
              Meu perfil
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => router.push(ROUTES.settings)}
            >
              <Settings className="w-4 h-4 mr-2" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={signOut}
              variant="destructive"
              className="cursor-pointer"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
