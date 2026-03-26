'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  eventos: 'Eventos',
  checklists: 'Checklists',
  manutencao: 'Manutenção',
  relatorios: 'Relatórios',
  admin: 'Admin',
  usuarios: 'Usuários',
  permissoes: 'Permissões',
  perfil: 'Meu Perfil',
  configuracoes: 'Configurações',
  logs: 'Logs de Auditoria',
  novo: 'Novo',
  editar: 'Editar',
}

export function Breadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length <= 1) return null

  const crumbs = segments.map((segment, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/')
    const label = SEGMENT_LABELS[segment] ?? segment
    const isLast = i === segments.length - 1
    const isUUID = /^[0-9a-f-]{36}$/i.test(segment)
    const displayLabel = isUUID ? 'Detalhes' : label

    return { href, label: displayLabel, isLast }
  })

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1 text-sm">
        {crumbs.map((crumb, i) => (
          <li key={crumb.href} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
            {crumb.isLast ? (
              <span className={cn('font-medium text-foreground truncate max-w-[200px]')}>
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="text-muted-foreground hover:text-foreground transition-colors truncate max-w-[150px]"
              >
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
