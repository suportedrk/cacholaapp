import { requirePermissionServer } from '@/lib/auth/require-permission'

/**
 * Guard para /vendas — módulo Vendas.
 * Governado por permissão configurável: check_permission(uid, 'vendas', 'view').
 * O toggle em /admin/cargos passa a controlar o acesso à rota (Fase 3, Parte 2).
 * Backfill de vendas.view aplicado na migration 122; gerente sai (sem vendas.view).
 */
export default async function VendasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePermissionServer('vendas', 'view')
  return <>{children}</>
}
