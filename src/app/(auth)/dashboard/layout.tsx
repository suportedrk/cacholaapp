import { requirePermissionServer } from '@/lib/auth/require-permission'

/**
 * Guard para /dashboard — módulo dashboard.
 * Governado por permissão configurável: check_permission(uid, 'dashboard', 'view').
 * O toggle em /admin/cargos passa a controlar o acesso à rota (Fase 3, Parte 2).
 * Backfill de dashboard.view aplicado na migration 126 (8 cargos: diretor, gerente,
 * financeiro, manutencao, vendedora, pos_vendas, decoracao, rh).
 * freelancer e entregador ficam fora — redirecionados para
 * /checklists/minhas-tarefas já no pós-login; este guard é a camada de
 * segurança server-side caso acessem diretamente.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePermissionServer('dashboard', 'view')
  return <>{children}</>
}
