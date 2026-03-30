'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, ArrowLeft } from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// Label map — URL segments → display labels
// ─────────────────────────────────────────────────────────────
export const SEGMENT_LABELS: Record<string, string> = {
  dashboard:      'Dashboard',
  eventos:        'Eventos',
  checklists:     'Checklists',
  manutencao:     'Manutenção',
  equipamentos:   'Equipamentos',
  prestadores:    'Prestadores',
  relatorios:     'Relatórios',
  perfil:         'Meu Perfil',
  configuracoes:  'Configurações',
  integracoes:    'Integrações',
  ploomes:        'Ploomes',
  mapeamento:     'Mapeamento',
  admin:          'Admin',
  usuarios:       'Usuários',
  unidades:       'Unidades',
  permissoes:     'Permissões',
  logs:           'Logs de Auditoria',
  novo:           'Novo',
  nova:           'Nova',
  editar:         'Editar',
}

// ─────────────────────────────────────────────────────────────
// Shared crumb builder
// ─────────────────────────────────────────────────────────────
// Segments that are structural prefixes and should be hidden from the breadcrumb
// (the URL is preserved, but the label is not shown as a crumb)
const HIDDEN_SEGMENTS = new Set(['admin'])

function buildCrumbs(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)

  // Skip dashboard (home) and root
  if (segments.length === 0 || segments[0] === 'dashboard') return []

  return segments
    .map((segment, i) => {
      const href    = '/' + segments.slice(0, i + 1).join('/')
      const isUUID  = /^[0-9a-f-]{36}$/i.test(segment)
      const label   = isUUID
        ? 'Detalhes'
        : (SEGMENT_LABELS[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1))
      const isLast  = i === segments.length - 1
      return { href, label, isLast, hidden: HIDDEN_SEGMENTS.has(segment) }
    })
    .filter((crumb) => !crumb.hidden)
    .map((crumb, i, arr) => ({ ...crumb, isLast: i === arr.length - 1 }))
}

// ─────────────────────────────────────────────────────────────
// Desktop Breadcrumb
// ─────────────────────────────────────────────────────────────

/** Collapse middle items when > 4 levels: first › ... › n-1 › last */
function collapseCrumbs(crumbs: ReturnType<typeof buildCrumbs>) {
  if (crumbs.length <= 4) return crumbs
  return [
    crumbs[0],
    { href: '', label: '…', isLast: false, isEllipsis: true },
    crumbs[crumbs.length - 2],
    crumbs[crumbs.length - 1],
  ]
}

export function Breadcrumbs() {
  const crumbs = collapseCrumbs(buildCrumbs(usePathname()))
  if (crumbs.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className="min-w-0 overflow-hidden">
      <ol className="flex items-center gap-1 text-sm whitespace-nowrap overflow-hidden">
        {crumbs.map((crumb, i) => {
          const c = crumb as typeof crumb & { isEllipsis?: boolean }
          return (
            <li key={c.href || i} className="flex items-center gap-1 shrink-0">
              {i > 0 && (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              )}
              {c.isEllipsis ? (
                <span className="text-muted-foreground select-none">…</span>
              ) : c.isLast ? (
                <span
                  className="font-medium text-foreground max-w-[200px] overflow-hidden text-ellipsis"
                  aria-current="page"
                >
                  {c.label}
                </span>
              ) : (
                <Link
                  href={c.href}
                  className="text-muted-foreground hover:text-foreground transition-colors max-w-[150px] overflow-hidden text-ellipsis"
                >
                  {c.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

// ─────────────────────────────────────────────────────────────
// Mobile Back Button
// Only shows when there is a parent to go back to (depth ≥ 2).
// For depth = 1 (e.g. /configuracoes), renders the fallback.
// ─────────────────────────────────────────────────────────────
interface MobileBackButtonProps {
  /** Rendered when there is no parent route (top-level pages) */
  fallback?: React.ReactNode
}

export function MobileBackButton({ fallback }: MobileBackButtonProps) {
  const crumbs = buildCrumbs(usePathname())

  if (crumbs.length < 2) return <>{fallback}</>

  const parent = crumbs[crumbs.length - 2]

  return (
    <Link
      href={parent.href}
      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
      aria-label={`Voltar para ${parent.label}`}
    >
      <ArrowLeft className="w-4 h-4 shrink-0" />
      <span className="truncate max-w-[140px] font-medium">{parent.label}</span>
    </Link>
  )
}
