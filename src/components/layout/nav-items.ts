import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  Wrench,
  Users,
  BarChart3,
  Settings,
  ScrollText,
  Building2,
  Package,
} from 'lucide-react'
import { ROUTES } from '@/lib/constants'
import type { Module } from '@/types/permissions'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  module?: Module
  badge?: number
  children?: NavItem[]
}

export interface NavGroup {
  /** Label de seção — exibida em uppercase acima do grupo */
  label?: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { label: 'Dashboard',   href: ROUTES.dashboard, icon: LayoutDashboard },
      { label: 'Eventos',     href: ROUTES.events,    icon: CalendarDays,  module: 'events'    },
      { label: 'Checklists',  href: ROUTES.checklists,icon: ClipboardList,  module: 'checklists'},
    ],
  },
  {
    label: 'Operações',
    items: [
      { label: 'Manutenção',   href: ROUTES.maintenance, icon: Wrench,   module: 'maintenance' },
      { label: 'Equipamentos', href: ROUTES.equipment,   icon: Package,  module: 'maintenance' },
      { label: 'Relatórios',   href: ROUTES.reports,     icon: BarChart3,module: 'reports'     },
    ],
  },
  {
    label: 'Administração',
    items: [
      { label: 'Usuários',       href: ROUTES.users,      icon: Users,     module: 'users'      },
      { label: 'Unidades',       href: ROUTES.units,      icon: Building2, module: 'users'      },
      { label: 'Logs',           href: ROUTES.auditLogs,  icon: ScrollText,module: 'audit_logs' },
      { label: 'Configurações',  href: ROUTES.settings,   icon: Settings,  module: 'settings'   },
    ],
  },
]

/** Lista plana — mantida para compatibilidade com breadcrumbs e outros usos */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items)
