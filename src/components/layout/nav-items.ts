import type { LucideIcon } from 'lucide-react'
import {
  Home,
  LayoutDashboard,
  CalendarDays,
  CalendarClock,
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
  Shield,
  Palette,
  Droplet,
  Sparkles,
  Wind,
  Truck,
  MapPin,
  Boxes,
  Warehouse,
  ArrowLeftRight,
  Tag,
  ShieldAlert,
  LifeBuoy,
} from 'lucide-react'
import { ROUTES } from '@/lib/constants'
import type { Module, Role } from '@/types/permissions'
import {
  BI_ACCESS_ROLES,
  VENDAS_MODULE_ROLES,
  COMMERCIAL_CHECKLIST_ACCESS_ROLES,
  COMMERCIAL_CHECKLIST_MANAGE_ROLES,
  MAINTENANCE_MODULE_ROLES,
  EQUIPAMENTOS_MENU_ROLES,
  MAINTENANCE_ADMIN_ROLES,
  PRESTADORES_ACCESS_ROLES,
  BACKUP_VIEW_ROLES,
  ADMIN_ACCESS_ROLES,
  ADMIN_USERS_MANAGE_ROLES,
  OPERATIONAL_CHECKLIST_ROLES,
  TEAM_TASKS_ROLES,
  EVENTOS_ACCESS_ROLES,
  ATAS_ACCESS_ROLES,
  DASHBOARD_ACCESS_ROLES,
  SETTINGS_ROLES,
  TEMPLATE_MANAGE_ROLES,
  DECORACAO_MANAGE_ROLES,
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

// ─────────────────────────────────────────────────────────────────────────────
// Todas as constantes de roles são importadas de @/config/roles — fonte única.
// ─────────────────────────────────────────────────────────────────────────────

export const NAV_GROUPS: NavGroup[] = [
  {
    // Sem label de grupo — itens principais (todos os roles veem)
    items: [
      { label: 'Início',         href: ROUTES.dashboard,  icon: Home,          allowedRoles: [...DASHBOARD_ACCESS_ROLES] },
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
      { label: 'Eventos',        href: ROUTES.events,     icon: CalendarDays,  module: 'eventos',   allowedRoles: [...EVENTOS_ACCESS_ROLES] },
      { label: 'Checklist Operacional', href: ROUTES.checklists, icon: ClipboardList, module: 'checklists', allowedRoles: [...OPERATIONAL_CHECKLIST_ROLES] },
      { label: 'Minhas Tarefas',   href: ROUTES.myTasks,    icon: ListTodo,     module: 'checklists', allowedRoles: [...OPERATIONAL_CHECKLIST_ROLES] },
      { label: 'Tarefas da Equipe', href: ROUTES.teamTasks,  icon: UsersRound,   module: 'checklists', allowedRoles: [...TEAM_TASKS_ROLES] },
      // Central de Serviços — área de uso geral. allowedRoles omitido de propósito:
      // central_servicos.view é concedido a TODOS os cargos; o gate real de
      // check_permission vive no layout (requirePermissionServer). A sidebar é só
      // apresentação por cargo, então "todos veem" = allowedRoles undefined.
      { label: 'Central de Serviços', href: ROUTES.centralServicos, icon: LifeBuoy, module: 'central_servicos' },
    ],
  },
  {
    label: 'Operações',
    items: [
      {
        label: 'Manutenção', href: ROUTES.maintenance, icon: Wrench, module: 'manutencao', allowedRoles: [...MAINTENANCE_MODULE_ROLES],
        children: [
          { label: 'Dashboard',     href: ROUTES.maintenanceDashboard, icon: LayoutDashboard, module: 'manutencao',    allowedRoles: [...MAINTENANCE_ADMIN_ROLES]   },
          { label: 'Chamados',      href: ROUTES.maintenanceChamados,  icon: ClipboardList,   module: 'manutencao',    allowedRoles: [...MAINTENANCE_MODULE_ROLES]  },
          { label: 'Agenda',        href: ROUTES.maintenanceAgenda,    icon: CalendarClock,   module: 'manutencao',    allowedRoles: [...MAINTENANCE_ADMIN_ROLES]   },
          { label: 'Minhas Tarefas', href: ROUTES.maintenanceMinhasTarefas, icon: ListTodo,   module: 'manutencao',    allowedRoles: [...MAINTENANCE_MODULE_ROLES]  },
          { label: 'Equipamentos',  href: ROUTES.equipment,            icon: Package,         module: 'equipamentos',  allowedRoles: [...EQUIPAMENTOS_MENU_ROLES]   },
          { label: 'Configurações', href: ROUTES.maintenanceConfig,    icon: Settings2,       module: 'manutencao',    allowedRoles: [...MAINTENANCE_ADMIN_ROLES]   },
        ],
      },
      { label: 'Prestadores',  href: ROUTES.providers,   icon: Handshake, module: 'prestadores',  allowedRoles: [...PRESTADORES_ACCESS_ROLES]  },
      {
        label: 'Decoração', href: ROUTES.decoracaoTemas, icon: Palette, module: 'decoracao', allowedRoles: [...DECORACAO_MANAGE_ROLES],
        children: [
          { label: 'Ordens de serviço', href: ROUTES.decoracaoOrdens,    icon: ClipboardList, module: 'decoracao', allowedRoles: [...DECORACAO_MANAGE_ROLES] },
          { label: 'Cores de forminhas', href: ROUTES.decoracaoForminhas, icon: Droplet,  module: 'decoracao', allowedRoles: [...DECORACAO_MANAGE_ROLES] },
          { label: 'Temas',              href: ROUTES.decoracaoTemas,      icon: Sparkles, module: 'decoracao', allowedRoles: [...DECORACAO_MANAGE_ROLES] },
          { label: 'Balões',             href: ROUTES.decoracaoBaloes,     icon: Wind,     module: 'decoracao', allowedRoles: [...DECORACAO_MANAGE_ROLES] },
          { label: 'Fornecedores',       href: ROUTES.decoracaoFornecedores, icon: Truck,   module: 'decoracao', allowedRoles: [...DECORACAO_MANAGE_ROLES] },
          { label: 'Locais de guarda',   href: ROUTES.decoracaoLocais,       icon: MapPin,  module: 'decoracao', allowedRoles: [...DECORACAO_MANAGE_ROLES] },
          { label: 'Categorias',         href: ROUTES.decoracaoCategorias,   icon: Tag,     module: 'decoracao', allowedRoles: [...DECORACAO_MANAGE_ROLES] },
          { label: 'Estoque',            href: ROUTES.decoracaoEstoque,      icon: Warehouse, module: 'decoracao', allowedRoles: [...DECORACAO_MANAGE_ROLES] },
          { label: 'Transferências',     href: ROUTES.decoracaoTransferencias, icon: ArrowLeftRight, module: 'decoracao', allowedRoles: [...DECORACAO_MANAGE_ROLES] },
          { label: 'Quarentena',         href: ROUTES.decoracaoQuarentena,   icon: ShieldAlert, module: 'decoracao', allowedRoles: [...DECORACAO_MANAGE_ROLES] },
          { label: 'Itens',              href: ROUTES.decoracaoItens,        icon: Boxes,   module: 'decoracao', allowedRoles: [...DECORACAO_MANAGE_ROLES] },
        ],
      },
      { label: 'Atas',         href: ROUTES.minutes,     icon: FileText,  module: 'atas',         allowedRoles: [...ATAS_ACCESS_ROLES]  },
      { label: 'Relatórios',   href: ROUTES.reports,     icon: BarChart3, module: 'relatorios',   allowedRoles: [...BI_ACCESS_ROLES] },
    ],
  },
  {
    label: 'Administração',
    items: [
      { label: 'Usuários',          href: ROUTES.users,          icon: Users,      module: 'usuarios',     allowedRoles: [...ADMIN_USERS_MANAGE_ROLES] },
      { label: 'Unidades',          href: ROUTES.units,          icon: Building2,  module: 'unidades',     allowedRoles: [...ADMIN_ACCESS_ROLES]      },
      { label: 'Vendedoras',        href: '/configuracoes/vendedoras', icon: UserCog, module: 'vendedoras', allowedRoles: [...ADMIN_ACCESS_ROLES]    },
      { label: 'Cargos',            href: '/admin/cargos',       icon: Shield,                               allowedRoles: [...TEMPLATE_MANAGE_ROLES]   },
      { label: 'Logs',              href: ROUTES.auditLogs,      icon: ScrollText, module: 'logs',         allowedRoles: [...ADMIN_ACCESS_ROLES]      },
      { label: 'Backups',           href: ROUTES.backups,        icon: HardDrive,  module: 'backups',      allowedRoles: [...BACKUP_VIEW_ROLES] },
      { label: 'Configurações',     href: ROUTES.settings,       icon: Settings,   module: 'configuracoes', allowedRoles: [...SETTINGS_ROLES] },
      { label: 'Regras de Negócio', href: ROUTES.businessRules,  icon: BookOpen,   module: 'configuracoes', allowedRoles: [...SETTINGS_ROLES] },
    ],
  },
]

/** Lista plana — mantida para compatibilidade com breadcrumbs e outros usos */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items)
