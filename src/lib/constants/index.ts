// ============================================================
// CONSTANTES GLOBAIS — Cachola OS
// ============================================================

export const APP_NAME = 'Cachola OS'
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0'

// ============================================================
// ROLES
// ============================================================
export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin (T.I.)',
  diretor: 'Diretor',
  gerente: 'Gerente',
  vendedora: 'Vendedora',
  decoracao: 'Decoração',
  manutencao: 'Manutenção',
  financeiro: 'Financeiro',
  rh: 'RH',
  freelancer: 'Freelancer',
  entregador: 'Entregador',
}

// ============================================================
// MÓDULOS
// ============================================================
export const MODULE_LABELS: Record<string, string> = {
  events: 'Eventos',
  maintenance: 'Manutenção',
  checklists: 'Checklists',
  users: 'Usuários',
  reports: 'Relatórios',
  audit_logs: 'Logs de Auditoria',
  notifications: 'Notificações',
  settings: 'Configurações',
  minutes: 'Atas de Reunião',
}

export const ACTION_LABELS: Record<string, string> = {
  view: 'Visualizar',
  create: 'Criar',
  edit: 'Editar',
  delete: 'Excluir',
  export: 'Exportar',
}

// ============================================================
// ROTAS
// ============================================================
export const ROUTES = {
  home: '/',
  login: '/login',
  forgotPassword: '/recuperar-senha',
  dashboard: '/dashboard',
  events: '/eventos',
  maintenance: '/manutencao',
  maintenanceDashboard: '/manutencao/dashboard',
  maintenanceChamados: '/manutencao/chamados',
  maintenanceConfig: '/manutencao/configuracoes',
  checklists: '/checklists',
  users: '/admin/usuarios',
  units: '/admin/unidades',
  profile: '/perfil',
  settings: '/configuracoes',
  reports: '/relatorios',
  auditLogs: '/admin/logs',
  equipment: '/equipamentos',
  myTasks: '/checklists/minhas-tarefas',
  teamTasks: '/checklists/tarefas-equipe',
  providers: '/prestadores',
  businessRules: '/configuracoes/regras',
  unitSetup: '/admin/unidades/setup',
  minutes: '/atas',
  vendas: '/vendas',
  commercialChecklist: '/vendas/checklist',
  commercialChecklistEquipe: '/vendas/checklist/equipe',
  commercialChecklistTemplates: '/vendas/checklist/templates',
  commercialChecklistAutomacoes: '/vendas/checklist/automacoes',
  backups: '/admin/backups',
} as const

// ============================================================
// PAGINAÇÃO
// ============================================================
export const DEFAULT_PAGE_SIZE = 20

// ============================================================
// STATUS DE EVENTO
// ============================================================
export const EVENT_STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  confirmed: 'Confirmado',
  in_progress: 'Em Andamento',
  completed: 'Concluído',
  cancelled: 'Cancelado',
}

export const EVENT_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  confirmed: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

// ============================================================
// STATUS DE ORDEM DE MANUTENÇÃO
// ============================================================
export const MAINTENANCE_STATUS_LABELS: Record<string, string> = {
  open: 'Aberta',
  in_progress: 'Em Andamento',
  waiting_parts: 'Aguardando Peças',
  completed: 'Concluída',
  cancelled: 'Cancelada',
}

export const MAINTENANCE_PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
}
