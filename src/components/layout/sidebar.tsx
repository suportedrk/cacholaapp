'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { X } from 'lucide-react'
import { NAV_ITEMS } from './nav-items'
import { cn } from '@/lib/utils'
import { APP_NAME } from '@/lib/constants'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <>
      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-surface-inverse/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          // Base
          'fixed top-0 left-0 z-40 h-full w-64 flex flex-col',
          'bg-sidebar border-r border-sidebar-border',
          'transition-transform duration-300 ease-in-out',
          // Mobile: slide in/out
          'lg:translate-x-0 lg:static lg:z-auto',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-label="Navegação principal"
      >
        {/* Header da sidebar */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2" onClick={onClose}>
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-primary-foreground">C</span>
            </div>
            <span className="font-semibold text-foreground text-sm">{APP_NAME}</span>
          </Link>

          {/* Fechar no mobile */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navegação */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
                  'transition-colors duration-150',
                  'min-h-[44px]', // área de toque mínima
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <item.icon
                  className={cn('w-5 h-5 shrink-0', isActive ? 'text-primary-foreground' : 'text-muted-foreground')}
                />
                <span className="truncate">{item.label}</span>
                {item.badge != null && item.badge > 0 && (
                  <span className="ml-auto text-xs font-medium bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Rodapé da sidebar */}
        <div className="px-4 py-3 border-t border-sidebar-border shrink-0">
          <p className="text-xs text-muted-foreground text-center">
            v{process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0'}
          </p>
        </div>
      </aside>
    </>
  )
}
