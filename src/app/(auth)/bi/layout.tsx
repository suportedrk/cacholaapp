import { requirePermissionServer } from '@/lib/auth/require-permission'

/**
 * Guard para /bi — módulo BI.
 * Governado por permissão configurável: check_permission(uid, 'bi', 'view').
 * O toggle em /admin/cargos passa a controlar o acesso à rota (Fase 3, Parte 2).
 * Backfill de bi.view aplicado na migration 124; gerente/financeiro saem (G2=C/G3).
 *
 * As abas internas (Atendimento → bi_atendimento, Vendas Realizadas → bi_vendas)
 * seguem gated por hasRole no client (display D3): sob C, super_admin+diretor
 * veem ambas. Os RPCs por trás de cada aba foram convertidos para
 * check_permission_or_raise no módulo correto na migration 125.
 */
export default async function BiLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePermissionServer('bi', 'view')
  return <>{children}</>
}
