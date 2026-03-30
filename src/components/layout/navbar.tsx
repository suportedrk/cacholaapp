'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, LogOut, User as UserIcon, Settings, WifiOff, Sun, Moon, Search } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { useTheme } from '@/components/theme-provider'
import { useCommandPaletteStore } from '@/stores/command-palette-store'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { NotificationBell } from './notification-bell'
import { Breadcrumbs, MobileBackButton } from './breadcrumbs'
import { UnitSwitcher } from './unit-switcher'
import { useAuth } from '@/hooks/use-auth'
import { getInitials, getAvatarColor, cn } from '@/lib/utils'
import { ROUTES } from '@/lib/constants'

interface NavbarProps {
  onMenuClick: () => void
  scrolled?: boolean
}

export function Navbar({ onMenuClick, scrolled }: NavbarProps) {
  const router = useRouter()
  const { profile, signOut } = useAuth()
  const { isOnline } = useOnlineStatus()
  const { resolvedTheme, toggleTheme } = useTheme()
  const openPalette = useCommandPaletteStore((s) => s.open)
  // All @base-ui DropdownMenuTrigger components must be deferred until after
  // hydration — MenuPrimitive.Trigger is not SSR-safe and causes tree mismatches.
  const [clientReady, setClientReady] = useState(false)
  const initials = profile ? getInitials(profile.name) : 'U'
  const avatarColor = profile ? getAvatarColor(profile.name) : ''

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setClientReady(true) }, [])

  return (
    <header className={cn(
      'sticky top-0 z-20 flex items-center gap-3 px-4 bg-card border-b border-border',
      'h-12 lg:h-14',
      'transition-shadow duration-200',
      scrolled ? 'shadow-sm' : 'shadow-none',
    )}>
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

      {/* Mobile: back button on sub-pages, logo on top-level */}
      <div className="lg:hidden flex items-center gap-2 mr-auto min-w-0">
        <MobileBackButton
          fallback={
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary-foreground">C</span>
              </div>
              <span className="font-semibold text-sm text-foreground">Cachola OS</span>
            </div>
          }
        />
      </div>

      {/* Breadcrumbs — desktop */}
      <div className="hidden lg:flex flex-1 min-w-0 overflow-hidden">
        <Breadcrumbs />
      </div>

      {/* Espaço flex no mobile */}
      <div className="flex-1 lg:hidden" />

      {/* Ações direita — todos diferidos até pós-hidratação */}
      <div className="flex items-center gap-1 shrink-0">
        {clientReady && !isOnline && (
          <span
            className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
            title="Sem conexão com a internet"
          >
            <WifiOff className="w-3 h-3" />
            <span className="hidden sm:inline">Offline</span>
          </span>
        )}

        {/* Busca / Command Palette */}
        {clientReady && (
          <button
            onClick={openPalette}
            className={cn(
              'p-2 rounded-lg text-muted-foreground interactive',
              'hover:bg-accent hover:text-foreground',
              'min-h-[44px] min-w-[44px] flex items-center justify-center',
            )}
            aria-label="Abrir busca (Ctrl+K)"
            title="Buscar (Ctrl+K)"
          >
            <Search className="w-4 h-4" />
          </button>
        )}

        {clientReady && (
          <span data-tour="unit-switcher">
            <UnitSwitcher />
          </span>
        )}

        {/* Toggle de tema — sol/lua */}
        {clientReady && (
          <button
            onClick={toggleTheme}
            className={cn(
              'p-2 rounded-lg text-muted-foreground interactive',
              'hover:bg-accent hover:text-foreground',
              'min-h-[44px] min-w-[44px] flex items-center justify-center',
            )}
            aria-label={resolvedTheme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
            title={resolvedTheme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
        )}

        {clientReady && (
          <span data-tour="notifications">
            <NotificationBell />
          </span>
        )}

        {/* Avatar + Dropdown — placeholder estático até montar */}
        {clientReady ? (
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
              {/* Header de perfil — div simples, não GroupLabel (exige Group pai) */}
              <div className="px-1.5 py-1.5 flex flex-col space-y-0.5">
                <p className="text-sm font-medium">{profile?.name ?? 'Usuário'}</p>
                <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
              </div>
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
        ) : (
          <div className="min-h-[44px] min-w-[44px] p-1 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-muted" />
          </div>
        )}
      </div>
    </header>
  )
}
