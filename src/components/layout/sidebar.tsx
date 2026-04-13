'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { NAV_GROUPS } from './nav-items'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { APP_NAME } from '@/lib/constants'
import { useUnitBrand } from '@/hooks/use-unit-settings'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import type { Role } from '@/types/permissions'

interface SidebarProps {
  isOpen: boolean
  isCollapsed: boolean
  onClose: () => void
  onToggleCollapse: () => void
}

function useSidebarLogo() {
  const { logoPath, displayName, accentColor } = useUnitBrand()
  if (!logoPath) return { logoUrl: null, displayName, accentColor }

  const { data } = createClient().storage.from('user-avatars').getPublicUrl(logoPath)
  return { logoUrl: data.publicUrl, displayName, accentColor }
}

export function Sidebar({ isOpen, isCollapsed, onClose, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname()
  const { logoUrl, displayName } = useSidebarLogo()
  const { profile } = useAuth()

  // Role efetivo: quando impersonando, profile já é o do impersonado (P2)
  const effectiveRole = (profile?.role ?? 'freelancer') as Role

  // Items expandidos (accordion). Inicializa vazio — useEffect abre ao carregar.
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const toggleExpanded = (href: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(href)) next.delete(href)
      else next.add(href)
      return next
    })
  }

  // O item ativo é o mais específico que faz match com o pathname atual.
  // Inclui children na busca para que subitens também sejam considerados.
  const allNavItems = NAV_GROUPS.flatMap((g) =>
    g.items.flatMap((item) => [item, ...(item.children ?? [])])
  )
  const activeHref = allNavItems
    .filter((item) =>
      item.href === '/'
        ? pathname === '/'
        : pathname === item.href || pathname.startsWith(item.href + '/')
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null

  // Auto-expande parents que tenham um filho ativo quando o pathname muda.
  useEffect(() => {
    NAV_GROUPS.forEach((g) => {
      g.items.forEach((item) => {
        if (item.children?.some((child) =>
          child.href === activeHref || pathname.startsWith(child.href + '/')
        )) {
          setExpandedItems((prev) => new Set([...prev, item.href]))
        }
      })
    })
  }, [pathname, activeHref])

  // Filtra grupos removendo itens que o role atual não pode ver.
  // Grupos que ficarem completamente vazios são omitidos.
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items
      .filter((item) => {
        if (!item.allowedRoles || item.allowedRoles.length === 0) return true
        return item.allowedRoles.includes(effectiveRole)
      })
      .map((item) => ({
        ...item,
        children: item.children?.filter((child) => {
          if (!child.allowedRoles || child.allowedRoles.length === 0) return true
          return child.allowedRoles.includes(effectiveRole)
        }),
      })),
  })).filter((group) => group.items.length > 0)

  return (
    <>
      {/* ── Overlay mobile ── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        data-tour="sidebar"
        className={cn(
          // base
          'fixed top-0 left-0 h-full z-40 flex flex-col',
          'bg-card border-r border-border',
          // transição de largura + transform
          'transition-[width,transform] duration-300 ease-in-out overflow-hidden',
          // mobile: largura fixa 240px, slide por transform
          'w-64',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          // desktop: estática, largura controlada pelo estado
          'lg:static lg:translate-x-0 lg:z-auto',
          isCollapsed ? 'lg:w-16' : 'lg:w-64',
        )}
        aria-label="Navegação principal"
      >
        {/* ── Header ── */}
        <div className={cn(
          'flex items-center h-14 shrink-0 border-b border-border',
          'transition-[padding] duration-300',
          isCollapsed ? 'lg:justify-center lg:px-0 px-4' : 'px-4',
        )}>
          {/* Logo link — desktop collapsed mostra só ícone */}
          <Link
            href="/dashboard"
            onClick={onClose}
            className={cn(
              'flex items-center gap-2 min-w-0',
              isCollapsed && 'lg:justify-center',
            )}
          >
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0 overflow-hidden">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt={`Logo ${displayName || APP_NAME}`}
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              ) : (
                <span className="text-sm font-bold text-primary-foreground">
                  {(displayName || APP_NAME).charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <span className={cn(
              'font-semibold text-foreground text-sm truncate',
              'transition-[opacity,width] duration-150 overflow-hidden',
              isCollapsed ? 'lg:opacity-0 lg:w-0' : 'opacity-100 w-auto',
            )}>
              {displayName || APP_NAME}
            </span>
          </Link>

          {/* Fechar no mobile */}
          <button
            onClick={onClose}
            className={cn(
              'lg:hidden ml-auto p-1.5 rounded-md',
              'text-muted-foreground hover:text-foreground hover:bg-muted',
              'transition-colors',
            )}
            aria-label="Fechar menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Navegação ── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
          {visibleGroups.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-1' : ''}>
              {/* Label de seção */}
              {group.label && (
                <>
                  {/* Desktop colapsado: apenas divisor */}
                  <div className={cn(
                    'hidden lg:block mx-3 h-px bg-border my-2',
                    isCollapsed ? 'lg:block' : 'lg:hidden',
                  )} />
                  {/* Desktop expandido + mobile: label texto */}
                  <p className={cn(
                    'px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60',
                    'transition-[opacity,height] duration-150 overflow-hidden',
                    isCollapsed ? 'lg:opacity-0 lg:h-0 lg:py-0' : 'opacity-100',
                  )}>
                    {group.label}
                  </p>
                </>
              )}

              {/* Items */}
              <div className="px-2 space-y-0.5">
                {group.items.map((item) => {
                  const hasChildren = item.children && item.children.length > 0
                  const hasActiveChild = item.children?.some((c) => c.href === activeHref) ?? false
                  const isActive = !hasChildren && item.href === activeHref
                  const isExpanded = expandedItems.has(item.href)
                  const isDisabled = item.disabled === true

                  const linkClassName = cn(
                    'flex items-center rounded-lg min-h-[44px]',
                    'transition-all duration-150',
                    'gap-3 px-3 py-2',
                    isCollapsed && 'lg:justify-center lg:px-0 lg:gap-0',
                    isDisabled
                      ? 'opacity-50 cursor-not-allowed text-muted-foreground'
                      : isActive || hasActiveChild
                        ? 'bg-primary/10 text-primary dark:bg-primary/20'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )

                  const iconEl = (
                    <item.icon
                      className={cn(
                        'w-5 h-5 shrink-0',
                        isActive || hasActiveChild ? 'text-primary' : 'text-muted-foreground',
                      )}
                    />
                  )

                  const labelEl = (
                    <span className={cn(
                      'text-sm font-medium truncate',
                      'transition-[opacity,width] duration-150 overflow-hidden',
                      isCollapsed ? 'lg:opacity-0 lg:w-0' : 'opacity-100 w-auto',
                    )}>
                      {item.label}
                    </span>
                  )

                  // ── Item com subitens (accordion) ──────────────────────
                  if (hasChildren) {
                    // Collapsed: mostra ícone com tooltip → navega para primeiro filho
                    if (isCollapsed) {
                      const firstChild = item.children![0]
                      return (
                        <Tooltip key={item.href}>
                          <TooltipTrigger
                            render={
                              <Link
                                href={firstChild.href}
                                onClick={onClose}
                                aria-current={hasActiveChild ? 'page' : undefined}
                                className={linkClassName}
                              />
                            }
                          >
                            {iconEl}
                            {labelEl}
                          </TooltipTrigger>
                          <TooltipContent side="right" sideOffset={8}>
                            {item.label}
                          </TooltipContent>
                        </Tooltip>
                      )
                    }

                    // Expandido: botão accordion + subitens
                    return (
                      <div key={item.href}>
                        <button
                          type="button"
                          onClick={() => toggleExpanded(item.href)}
                          aria-expanded={isExpanded}
                          className={cn(
                            'w-full flex items-center rounded-lg min-h-[44px]',
                            'gap-3 px-3 py-2 transition-all duration-150',
                            hasActiveChild
                              ? 'bg-primary/10 text-primary dark:bg-primary/20'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                          )}
                        >
                          {iconEl}
                          <span className="text-sm font-medium truncate flex-1 text-left">
                            {item.label}
                          </span>
                          <ChevronDown className={cn(
                            'w-4 h-4 shrink-0 transition-transform duration-200',
                            isExpanded && 'rotate-180',
                          )} />
                        </button>

                        {/* Subitens */}
                        {isExpanded && (
                          <div className="ml-3 mt-0.5 pl-3 border-l border-border space-y-0.5">
                            {item.children!.map((child) => {
                              const childActive = child.href === activeHref
                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  onClick={onClose}
                                  aria-current={childActive ? 'page' : undefined}
                                  className={cn(
                                    'flex items-center gap-2.5 rounded-lg px-3 py-2 min-h-[40px]',
                                    'text-sm transition-all duration-150',
                                    childActive
                                      ? 'text-primary font-medium bg-primary/5 dark:bg-primary/10'
                                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                  )}
                                >
                                  <child.icon className="w-4 h-4 shrink-0" />
                                  <span className="truncate">{child.label}</span>
                                </Link>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  }

                  // ── Item simples (sem subitens) ────────────────────────
                  const linkChildren = (
                    <>
                      {iconEl}
                      {labelEl}
                      {item.badge != null && item.badge > 0 && (
                        <span className={cn(
                          'ml-auto text-xs font-medium rounded-full px-1.5 py-0.5',
                          'bg-primary/20 text-primary',
                          'transition-[opacity,width] duration-150 overflow-hidden',
                          isCollapsed ? 'lg:opacity-0 lg:w-0 lg:px-0' : 'opacity-100',
                        )}>
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                      {item.badgeText && (
                        <span className={cn(
                          'ml-auto text-[10px] font-medium rounded-full px-1.5 py-0.5 whitespace-nowrap',
                          'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
                          'transition-[opacity,width] duration-150 overflow-hidden',
                          isCollapsed ? 'lg:opacity-0 lg:w-0 lg:px-0' : 'opacity-100',
                        )}>
                          {item.badgeText}
                        </span>
                      )}
                    </>
                  )

                  // Item desabilitado: div em vez de Link (não navega)
                  if (isDisabled) {
                    return (
                      <div
                        key={item.href}
                        aria-disabled="true"
                        className={linkClassName}
                      >
                        {linkChildren}
                      </div>
                    )
                  }

                  // Tooltip só ativo quando collapsed (desktop)
                  return isCollapsed ? (
                    <Tooltip key={item.href}>
                      <TooltipTrigger
                        render={
                          <Link
                            href={item.href}
                            onClick={onClose}
                            aria-current={isActive ? 'page' : undefined}
                            className={linkClassName}
                          />
                        }
                      >
                        {linkChildren}
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={8}>
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      aria-current={isActive ? 'page' : undefined}
                      className={linkClassName}
                    >
                      {linkChildren}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* ── Footer ── */}
        <div className={cn(
          'shrink-0 border-t border-border',
          'flex items-center px-4 py-3',
          isCollapsed && 'lg:justify-center lg:px-2',
        )}>
          {/* Versão — esconde quando collapsed */}
          <span className={cn(
            'text-xs text-muted-foreground',
            'transition-[opacity,width] duration-150 overflow-hidden',
            isCollapsed ? 'lg:opacity-0 lg:w-0' : 'opacity-100 w-auto',
          )}>
            v{process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0'}
          </span>

          {/* Botão collapse — apenas desktop */}
          <Tooltip>
            <TooltipTrigger
              onClick={onToggleCollapse}
              className={cn(
                'hidden lg:flex items-center justify-center',
                'p-1.5 rounded-md',
                'text-muted-foreground hover:text-foreground hover:bg-muted',
                'transition-colors ml-auto',
                isCollapsed && 'lg:ml-0',
              )}
              aria-label={isCollapsed ? 'Expandir menu' : 'Colapsar menu'}
            >
              {isCollapsed
                ? <ChevronRight className="w-4 h-4" />
                : <ChevronLeft className="w-4 h-4" />
              }
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {isCollapsed ? 'Expandir menu' : 'Colapsar menu'}
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </>
  )
}
