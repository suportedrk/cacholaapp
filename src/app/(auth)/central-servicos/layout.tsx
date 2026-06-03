import { requirePermissionServer } from '@/lib/auth/require-permission'

/**
 * Guard do módulo Central de Serviços (/central-servicos).
 *
 * Governado por permissão configurável: check_permission(uid, 'central_servicos', 'view').
 * O toggle em /admin/cargos controla o acesso à rota. `view` é concedido a TODOS
 * os cargos por padrão (migration 144); super_admin é bypassado em check_permission.
 *
 * Módulo global — NÃO aplica filtro de RLS por unidade. É uma área da empresa toda;
 * a unidade será apenas informativa nos contatos (bloco futuro), nunca trava de acesso.
 */
export default async function CentralServicosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePermissionServer('central_servicos', 'view')
  return <>{children}</>
}
