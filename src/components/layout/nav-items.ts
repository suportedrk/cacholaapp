import type { LucideIcon } from 'lucide-react'
import {
  Home,
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
  FileText,
  UserCog,
  TrendingUp,
  ClipboardCheck,
  Zap,
  HardDrive,
} from 'lucide-react'
import { ROUTES } from '@/lib/constants'
import type { Module, Role } from '@/types/permissions'
import {
  BI_ACCESS_ROLES,
  VENDAS_MODULE_ROLES,
  COMMERCIAL_CHECKLIST_ACCESS_ROLES,
  COMMERCIAL_CHECKLIST_MANAGE_ROLES,
  MAINTENANCE_MODULE_ROLES,
  PRESTADORES_ACCESS_ROLES,
  BACKUP_VIEW_ROLES,
} from '@/config/roles'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  module?: Module
  badge?: number
  /** Badge de texto (ex: "Em breve") — exibido como pill ao lado do label */
  badgeText?: string
  /** Item desabilitado — exibe opacidade 50%, cursor not-allowed, não navega */
  disabled?: boolean
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
      { label: 'Início',         href: ROUTES.dashboard,  icon: Home },
      { label: 'BI',             href: '/bi',             icon: BarChart3,    allowedRoles: [...BI_ACCESS_ROLES]        },
      { label: 'Vendas',         href: ROUTES.vendas,     icon: TrendingUp,   allowedRoles: [...VENDAS_MODULE_ROLES]    },
      {
        label: 'Checklist Comercial',
        href:  ROUTES.commercialChecklist,
        icon:  ClipboardCheck,
        allowedRoles: [...COMMERCIAL_CHECKLIST_ACCESS_ROLES],
        children: [
          {
            label: 'Minhas Tarefas',
            href:  ROUTES.commercialChecklist,
            icon:  ClipboardCheck,
            allowedRoles: [...COMMERCIAL_CHECKLIST_ACCESS_ROLES],
          },
          {
            label: 'Equipe Comercial',
            href:  ROUTES.commercialChecklistEquipe,
            icon:  UsersRound,
            allowedRoles: [...COMMERCIAL_CHECKLIST_MANAGE_ROLES],
          },
          {
            label: 'Templates',
            href:  ROUTES.commercialChecklistTemplates,
            icon:  FileText,
            allowedRoles: [...COMMERCIAL_CHECKLIST_MANAGE_ROLES],
          },
          {
            label: 'Automações',
            href:  ROUTES.commercialChecklistAutomacoes,
            icon:  Zap,
            allowedRoles: [...COMMERCIAL_CHECKLIST_MANAGE_ROLES],
          },
        ],
      },
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
        label: 'Manutenção', href: ROUTES.maintenance, icon: Wrench, module: 'maintenance', allowedRoles: [...MAINTENANCE_MODULE_ROLES],
        children: [
          { label: 'Dashboard',     href: ROUTES.maintenanceDashboard, icon: LayoutDashboard, module: 'maintenance', allowedRoles: [...MAINTENANCE_MODULE_ROLES] },
          { label: 'Chamados',      href: ROUTES.maintenanceChamados,  icon: ClipboardList,   module: 'maintenance', allowedRoles: [...MAINTENANCE_MODULE_ROLES] },
          { label: 'Configurações', href: ROUTES.maintenanceConfig,    icon: Settings2,       module: 'maintenance', allowedRoles: [...MAINTENANCE_MODULE_ROLES] },
        ],
      },
      { label: 'Equipamentos', href: ROUTES.equipment,   icon: Package,   module: 'maintenance', allowedRoles: [...MAINTENANCE_MODULE_ROLES]  },
      { label: 'Prestadores',  href: ROUTES.providers,   icon: Handshake, module: 'providers',   allowedRoles: [...PRESTADORES_ACCESS_ROLES]  },
      { label: 'Atas',         href: ROUTES.minutes,     icon: FileText,  module: 'minutes'                                    },
      { label: 'Relatórios',   href: ROUTES.reports,     icon: BarChart3, module: 'reports',     allowedRoles: [...BI_ACCESS_ROLES] },
    ],
  },
  {
    label: 'Administração',
    items: [
      { label: 'Usuários',          href: ROUTES.users,          icon: Users,      module: 'users',      allowedRoles: USER_ADMIN_ROLES },
      { label: 'Unidades',          href: ROUTES.units,          icon: Building2,  module: 'users',      allowedRoles: ADMIN_ROLES      },
      { label: 'Vendedoras',        href: '/configuracoes/vendedoras', icon: UserCog, module: 'settings', allowedRoles: ADMIN_ROLES    },
      { label: 'Logs',              href: ROUTES.auditLogs,      icon: ScrollText, module: 'audit_logs', allowedRoles: ADMIN_ROLES      },
      { label: 'Backups',           href: ROUTES.backups,        icon: HardDrive,  module: 'settings',   allowedRoles: [...BACKUP_VIEW_ROLES] },
      { label: 'Configurações',     href: ROUTES.settings,       icon: Settings,   module: 'settings',   allowedRoles: SETTINGS_ROLES   },
      { label: 'Regras de Negócio', href: ROUTES.businessRules,  icon: BookOpen,   module: 'settings',   allowedRoles: SETTINGS_ROLES   },
    ],
  },
]

/** Lista plana — mantida para compatibilidade com breadcrumbs e outros usos */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items)
