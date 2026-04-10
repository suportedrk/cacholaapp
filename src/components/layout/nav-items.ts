import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  ListTodo,
  Wrench,
  Users,
  BarChart3,
  Settings,
  Settings2,
  ScrollText,
  Building2,
  Package,
  Handshake,
  BookOpen,
  UsersRound,
} from 'lucide-react'
import { ROUTES } from '@/lib/constants'
import type { Module, Role } from '@/types/permissions'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  module?: Module
  badge?: number
  children?: NavItem[]
  /**
   * Roles que podem ver este item.
   * undefined = sem restrição (todos os roles veem).
   */
  allowedRoles?: Role[]
}

export interface NavGroup {
  /** Label de seção — exibida em uppercase acima do grupo */
  label?: string
  items: NavItem[]
}

// ── Grupos de roles reutilizáveis ──────────────────────────────────────────────

/** Roles que gerenciam operações do dia a dia (Manutenção, Equipamentos, Prestadores) */
const OPS_ROLES: Role[] = ['super_admin', 'diretor', 'gerente', 'manutencao']

/** Roles com acesso a relatórios e financeiro */
const REPORT_ROLES: Role[] = ['super_admin', 'diretor', 'gerente', 'financeiro']

/** Roles com acesso a Prestadores (gestão de terceiros) */
const PROVIDER_ROLES: Role[] = ['super_admin', 'diretor', 'gerente']

/** Roles com acesso à visão de Tarefas da Equipe */
const TEAM_TASKS_ROLES: Role[] = ['super_admin', 'diretor', 'gerente']

/** Roles com acesso a gestão de usuários e unidades (RH incluso para usuários) */
const USER_ADMIN_ROLES: Role[] = ['super_admin', 'diretor', 'rh']

/** Roles com acesso a configurações avançadas e logs */
const ADMIN_ROLES: Role[] = ['super_admin', 'diretor']

/** Roles com acesso a configurações gerais (gerente pode ajustar horários, etc.) */
const SETTINGS_ROLES: Role[] = ['super_admin', 'diretor', 'gerente']

// ─────────────────────────────────────────────────────────────────────────────

export const NAV_GROUPS: NavGroup[] = [
  {
    // Sem label de grupo — itens principais (todos os roles veem)
    items: [
      { label: 'Dashboard',      href: ROUTES.dashboard,  icon: LayoutDashboard },
      { label: 'Eventos',        href: ROUTES.events,     icon: CalendarDays,  module: 'events'    },
      { label: 'Checklists',     href: ROUTES.checklists, icon: ClipboardList, module: 'checklists' },
      { label: 'Minhas Tarefas',   href: ROUTES.myTasks,    icon: ListTodo,     module: 'checklists' },
      { label: 'Tarefas da Equipe', href: ROUTES.teamTasks,  icon: UsersRound,   module: 'checklists', allowedRoles: TEAM_TASKS_ROLES },
    ],
  },
  {
    label: 'Operações',
    items: [
      {
        label: 'Manutenção', href: ROUTES.maintenance, icon: Wrench, module: 'maintenance', allowedRoles: OPS_ROLES,
        children: [
          { label: 'Dashboard',     href: ROUTES.maintenanceDashboard, icon: LayoutDashboard, module: 'maintenance', allowedRoles: OPS_ROLES },
          { label: 'Chamados',      href: ROUTES.maintenanceChamados,  icon: ClipboardList,   module: 'maintenance', allowedRoles: OPS_ROLES },
          { label: 'Configurações', href: ROUTES.maintenanceConfig,    icon: Settings2,       module: 'maintenance', allowedRoles: OPS_ROLES },
        ],
      },
      { label: 'Equipamentos', href: ROUTES.equipment,   icon: Package,   module: 'maintenance', allowedRoles: OPS_ROLES       },
      { label: 'Prestadores',  href: ROUTES.providers,   icon: Handshake, module: 'providers',   allowedRoles: PROVIDER_ROLES  },
      { label: 'Relatórios',   href: ROUTES.reports,     icon: BarChart3, module: 'reports',     allowedRoles: REPORT_ROLES    },
    ],
  },
  {
    label: 'Administração',
    items: [
      { label: 'Usuários',          href: ROUTES.users,          icon: Users,      module: 'users',      allowedRoles: USER_ADMIN_ROLES },
      { label: 'Unidades',          href: ROUTES.units,          icon: Building2,  module: 'users',      allowedRoles: ADMIN_ROLES      },
      { label: 'Logs',              href: ROUTES.auditLogs,      icon: ScrollText, module: 'audit_logs', allowedRoles: ADMIN_ROLES      },
      { label: 'Configurações',     href: ROUTES.settings,       icon: Settings,   module: 'settings',   allowedRoles: SETTINGS_ROLES   },
      { label: 'Regras de Negócio', href: ROUTES.businessRules,  icon: BookOpen,   module: 'settings',   allowedRoles: SETTINGS_ROLES   },
    ],
  },
]

/** Lista plana — mantida para compatibilidade com breadcrumbs e outros usos */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items)
